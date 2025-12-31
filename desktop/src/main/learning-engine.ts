/**
 * Personal Learning Engine
 * Connects Electron app to existing prompt-evolution analysis modules
 * Includes history tracking and progress analysis
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { ipcMain } from 'electron';
import {
  initializeDatabase,
  saveAnalysis,
  getRecentAnalyses,
  getScoreTrend,
  getGoldenAverages,
  getTopWeaknesses,
  getStats,
} from './db/index.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import analysis modules - built from parent project's src/analysis
// In development: dist/analysis (built by npm run build:analysis)
// In production: bundled with the app
const analysisPath = path.join(__dirname, '../analysis');

interface GOLDENScore {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
  total: number;
}

interface DetectedAntiPattern {
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
  fix: string;
}

interface GuidelineEvaluation {
  overallScore: number;
  guidelineScores: Array<{
    guideline: string;
    name: string;
    description: string;
    score: number;
    weight: number;
    evidence: string[];
    suggestion: string;
  }>;
  goldenScore: GOLDENScore;
  antiPatterns: DetectedAntiPattern[];
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface PromptClassification {
  intent: string;
  category: string;
  confidence: number;
}

interface AnalysisResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    suggestion: string;
  }>;
  personalTips: string[];
  improvedPrompt?: string;
  classification?: PromptClassification;
}

// Cache for loaded modules
let evaluatePromptAgainstGuidelines: ((text: string) => GuidelineEvaluation) | null = null;
let classifyPrompt: ((text: string) => PromptClassification) | null = null;

/**
 * Dynamically load analysis modules
 */
async function loadAnalysisModules(): Promise<boolean> {
  try {
    // Try to load the guidelines evaluator
    const guidelinesModule = await import(
      path.join(analysisPath, 'guidelines-evaluator.js')
    );
    evaluatePromptAgainstGuidelines = guidelinesModule.evaluatePromptAgainstGuidelines;

    // Try to load the classifier
    const classifierModule = await import(path.join(analysisPath, 'classifier.js'));
    classifyPrompt = classifierModule.classifyPrompt;

    console.log('[LearningEngine] Analysis modules loaded successfully');
    return true;
  } catch (error) {
    console.error('[LearningEngine] Failed to load analysis modules:', error);
    return false;
  }
}

/**
 * Convert GuidelineEvaluation to simplified AnalysisResult for UI
 */
function convertToAnalysisResult(
  evaluation: GuidelineEvaluation,
  classification?: PromptClassification
): AnalysisResult {
  // Convert anti-patterns to issues
  const issues = evaluation.antiPatterns.map((pattern) => ({
    severity: pattern.severity,
    category: pattern.pattern,
    message: pattern.description,
    suggestion: pattern.fix,
  }));

  // Add issues from low-scoring guidelines
  evaluation.guidelineScores
    .filter((g) => g.score < 0.5)
    .forEach((g) => {
      issues.push({
        severity: g.score < 0.3 ? 'high' : 'medium',
        category: g.guideline,
        message: g.name + ': ' + g.description,
        suggestion: g.suggestion,
      });
    });

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    overallScore: Math.round(evaluation.overallScore * 100),
    grade: evaluation.grade,
    goldenScores: {
      goal: Math.round(evaluation.goldenScore.goal * 100),
      output: Math.round(evaluation.goldenScore.output * 100),
      limits: Math.round(evaluation.goldenScore.limits * 100),
      data: Math.round(evaluation.goldenScore.data * 100),
      evaluation: Math.round(evaluation.goldenScore.evaluation * 100),
      next: Math.round(evaluation.goldenScore.next * 100),
    },
    issues: issues.slice(0, 5), // Top 5 issues
    personalTips: generatePersonalTips(evaluation),
    improvedPrompt: generateImprovedPrompt(evaluation),
    classification,
  };
}

/**
 * Generate personal tips based on evaluation
 */
function generatePersonalTips(evaluation: GuidelineEvaluation): string[] {
  const tips: string[] = [];

  // Add recommendations
  evaluation.recommendations.slice(0, 2).forEach((rec) => {
    tips.push(rec);
  });

  // Add tips based on lowest GOLDEN scores
  const goldenEntries = Object.entries(evaluation.goldenScore)
    .filter(([key]) => key !== 'total')
    .sort((a, b) => (a[1] as number) - (b[1] as number));

  const lowestArea = goldenEntries[0];
  if (lowestArea && (lowestArea[1] as number) < 0.5) {
    const areaMessages: Record<string, string> = {
      goal: '목표를 더 명확하게 정의해보세요',
      output: '원하는 출력 형식을 명시해보세요',
      limits: '제약조건이나 범위를 추가해보세요',
      data: '필요한 컨텍스트나 데이터를 제공해보세요',
      evaluation: '성공 기준을 정의해보세요',
      next: '후속 작업이나 예상 결과를 언급해보세요',
    };
    tips.push(areaMessages[lowestArea[0]] || '');
  }

  return tips.filter(Boolean).slice(0, 3);
}

/**
 * Generate improved prompt suggestion
 */
function generateImprovedPrompt(evaluation: GuidelineEvaluation): string | undefined {
  // For now, return recommendations as improvement hints
  // In future, could use AI to actually rewrite
  if (evaluation.recommendations.length > 0) {
    return `다음 사항을 추가하세요:\n${evaluation.recommendations.slice(0, 3).map((r) => `• ${r}`).join('\n')}`;
  }
  return undefined;
}

/**
 * Analyze a prompt and return structured result
 * Also saves to history for progress tracking
 */
async function analyzePrompt(text: string): Promise<AnalysisResult> {
  // Ensure modules are loaded
  if (!evaluatePromptAgainstGuidelines) {
    const loaded = await loadAnalysisModules();
    if (!loaded) {
      // Return fallback analysis if modules can't be loaded
      return createFallbackAnalysis(text);
    }
  }

  try {
    // Run evaluation
    const evaluation = evaluatePromptAgainstGuidelines!(text);

    // Run classification if available
    let classification: PromptClassification | undefined;
    if (classifyPrompt) {
      classification = classifyPrompt(text);
    }

    const result = convertToAnalysisResult(evaluation, classification);

    // Save to history for progress tracking
    try {
      saveAnalysis({
        promptText: text,
        overallScore: result.overallScore,
        grade: result.grade,
        goldenScores: result.goldenScores,
        issues: result.issues,
        improvedPrompt: result.improvedPrompt,
      });
    } catch (dbError) {
      console.warn('[LearningEngine] Failed to save to history:', dbError);
    }

    return result;
  } catch (error) {
    console.error('[LearningEngine] Analysis error:', error);
    return createFallbackAnalysis(text);
  }
}

/**
 * Create a basic fallback analysis when modules aren't available
 */
function createFallbackAnalysis(text: string): AnalysisResult {
  const wordCount = text.split(/\s+/).length;
  const hasQuestion = text.includes('?');
  const hasCodeBlock = text.includes('```');

  // Simple heuristic scoring
  let score = 50;
  if (wordCount > 20) score += 10;
  if (wordCount > 50) score += 10;
  if (hasCodeBlock) score += 10;
  if (hasQuestion) score += 5;

  const grade =
    score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';

  return {
    overallScore: score,
    grade,
    goldenScores: {
      goal: wordCount > 10 ? 60 : 40,
      output: hasCodeBlock ? 70 : 50,
      limits: 50,
      data: wordCount > 30 ? 70 : 40,
      evaluation: 40,
      next: 40,
    },
    issues: [
      {
        severity: 'medium',
        category: 'analysis',
        message: '분석 모듈을 로드할 수 없습니다',
        suggestion: '프로젝트 빌드를 확인하세요',
      },
    ],
    personalTips: ['분석 모듈 로드 실패 - 기본 분석 결과입니다'],
    improvedPrompt: undefined,
  };
}

/**
 * Register IPC handlers for learning engine
 */
export function registerLearningEngineHandlers(): void {
  // Initialize database
  try {
    initializeDatabase();
    console.log('[LearningEngine] Database initialized');
  } catch (error) {
    console.error('[LearningEngine] Database initialization failed:', error);
  }

  // Analyze prompt handler
  ipcMain.handle('analyze-prompt', async (_event, text: string) => {
    return analyzePrompt(text);
  });

  // History handlers
  ipcMain.handle('get-history', async (_event, limit?: number) => {
    return getRecentAnalyses(limit || 30);
  });

  ipcMain.handle('get-score-trend', async (_event, days?: number) => {
    return getScoreTrend(days || 30);
  });

  ipcMain.handle('get-golden-averages', async (_event, days?: number) => {
    return getGoldenAverages(days || 30);
  });

  ipcMain.handle('get-top-weaknesses', async (_event, limit?: number) => {
    return getTopWeaknesses(limit || 3);
  });

  ipcMain.handle('get-stats', async () => {
    return getStats();
  });

  // Initialize by loading modules
  loadAnalysisModules().then((loaded) => {
    if (loaded) {
      console.log('[LearningEngine] Ready');
    } else {
      console.warn('[LearningEngine] Running in fallback mode');
    }
  });
}

export { analyzePrompt };
