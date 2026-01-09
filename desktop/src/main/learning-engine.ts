/**
 * Personal Learning Engine
 * Connects Electron app to existing prompt-evolution analysis modules
 * Includes history tracking and progress analysis
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { app, ipcMain } from 'electron';
import {
  initializeDatabase,
  saveAnalysis,
  getRecentAnalyses,
  getScoreTrend,
  getGoldenAverages,
  getTopWeaknesses,
  getWeeklyStats,
  getMonthlyStats,
  getImprovementAnalysis,
  getStats,
} from './db/index.js';
import { generatePromptVariants, generateAIVariantOnly, RewriteResult, VariantType, type GOLDENEvaluator } from './prompt-rewriter.js';
import { getAIRewriteSettings, getLastCapturedContext } from './index.js';
import {
  getSessionContext,
  getSessionContextForPath,
  getActiveWindowSessionContext,
  getSessionContextForCapturedProject,
  SessionContext,
  ActiveSessionContext,
} from './session-context.js';
import {
  analyzeProjectPatterns,
  getContextRecommendations,
  enrichAnalysisWithHistory,
  type HistoryRecommendation,
  type ProjectPatternAnalysis,
  type PromptContextRecommendations,
} from './history-pattern-analyzer.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import analysis modules - bundled as CJS for Electron compatibility
// In development: dist/analysis/analysis-bundle.cjs
// In production: extraResources/analysis/analysis-bundle.cjs
const isDev = !app.isPackaged;
const analysisPath = isDev
  ? path.join(__dirname, '../analysis')
  : path.join(process.resourcesPath, 'analysis');
const analysisBundlePath = path.join(analysisPath, 'analysis-bundle.cjs');
const classifierBundlePath = path.join(analysisPath, 'classifier-bundle.cjs');

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
  improvedPrompt?: string; // deprecated, 호환성 유지
  promptVariants: RewriteResult[]; // 신규: 3가지 변형
  classification?: PromptClassification;
  sessionContext?: SessionContext; // 세션 컨텍스트 정보
  // Phase 2: History-based recommendations
  historyRecommendations?: HistoryRecommendation[];
  comparisonWithHistory?: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
}

// Re-export for renderer
export type {
  RewriteResult,
  VariantType,
  SessionContext,
  ActiveSessionContext,
  HistoryRecommendation,
  ProjectPatternAnalysis,
  PromptContextRecommendations,
};

// Cache for loaded modules
let evaluatePromptAgainstGuidelines: ((text: string) => GuidelineEvaluation) | null = null;
let classifyPrompt: ((text: string) => PromptClassification) | null = null;

/**
 * Load analysis modules from CJS bundle
 * Uses require() for CJS compatibility in packaged Electron apps
 */
async function loadAnalysisModules(): Promise<boolean> {
  try {
    // Check if bundle exists
    const fs = await import('fs');
    if (!fs.existsSync(analysisBundlePath)) {
      console.error('[LearningEngine] Analysis bundle not found at:', analysisBundlePath);
      return false;
    }

    // Use createRequire to load CJS modules from ESM context
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    // Load the bundled analysis module (CJS)
    const analysisModule = require(analysisBundlePath);
    evaluatePromptAgainstGuidelines = analysisModule.evaluatePromptAgainstGuidelines;

    // Load classifier if available
    if (fs.existsSync(classifierBundlePath)) {
      const classifierModule = require(classifierBundlePath);
      classifyPrompt = classifierModule.classifyPrompt;
    }

    console.log('[LearningEngine] Analysis modules loaded successfully from CJS bundle');
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
  originalText: string,
  classification?: PromptClassification,
  sessionContext?: SessionContext | null
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

  // 3가지 변형 생성 (세션 컨텍스트 활용)
  const promptVariants = generatePromptVariants(originalText, evaluation, sessionContext || undefined);

  // AI placeholder 추가 (AI가 활성화되지 않았을 때 설정 안내 표시)
  // analyzePrompt에서 AI가 성공하면 이 placeholder가 교체됨
  const aiSettings = getAIRewriteSettings();
  if (!aiSettings.enabled || !aiSettings.apiKey) {
    promptVariants.unshift({
      rewrittenPrompt: '',
      keyChanges: [],
      confidence: 0,
      variant: 'ai' as VariantType,
      variantLabel: 'AI 추천',
      isAiGenerated: false,
      needsSetup: true,
    });
  }

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
    improvedPrompt: promptVariants[1]?.rewrittenPrompt, // 호환성: 균형 버전
    promptVariants,
    classification,
    sessionContext: sessionContext || undefined,
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

// generateImprovedPrompt 함수 제거됨 - prompt-rewriter.ts의 generatePromptVariants로 대체

/**
 * Analyze a prompt and return structured result
 * Also saves to history for progress tracking
 */
async function analyzePrompt(text: string): Promise<AnalysisResult> {
  console.log('[LearningEngine] analyzePrompt START - text length:', text.length);

  // Ensure modules are loaded
  if (!evaluatePromptAgainstGuidelines) {
    console.log('[LearningEngine] Loading analysis modules...');
    const loaded = await loadAnalysisModules();
    if (!loaded) {
      console.log('[LearningEngine] Failed to load modules, returning fallback');
      // Return fallback analysis if modules can't be loaded
      return createFallbackAnalysis(text);
    }
    console.log('[LearningEngine] Modules loaded successfully');
  }

  try {
    console.log('[LearningEngine] Getting session context...');
    // Get session context for enhanced rewriting
    // Use captured context (from hotkey time) if available, otherwise fallback to real-time detection
    const capturedContext = getLastCapturedContext();
    let sessionContext: ActiveSessionContext | null = null;

    if (capturedContext) {
      // We have captured context from hotkey time
      if (capturedContext.project) {
        // IDE app with detected project - use captured project context
        sessionContext = await getSessionContextForCapturedProject(capturedContext);
      } else {
        // Non-IDE app (e.g., Antigravity, Safari) - no project context
        // Do NOT fallback to real-time detection to avoid showing wrong project
        console.log('[LearningEngine] Non-IDE app detected, no project context');
        sessionContext = null;
      }
    } else {
      // No captured context available - use real-time detection (legacy behavior)
      sessionContext = await getActiveWindowSessionContext();
    }

    // Run evaluation
    console.log('[LearningEngine] Running GOLDEN evaluation...');
    const evaluation = evaluatePromptAgainstGuidelines!(text);
    console.log('[LearningEngine] GOLDEN evaluation complete');

    // Run classification if available
    let classification: PromptClassification | undefined;
    if (classifyPrompt) {
      console.log('[LearningEngine] Running classification...');
      classification = classifyPrompt(text);
      console.log('[LearningEngine] Classification complete:', classification);
    }

    console.log('[LearningEngine] Converting to analysis result...');
    const result = convertToAnalysisResult(evaluation, text, classification, sessionContext);
    console.log('[LearningEngine] Conversion complete');

    // Phase 3.1: Async AI loading - Add loading placeholder instead of blocking
    // AI variant will be loaded separately via get-ai-variant IPC
    const aiSettings = getAIRewriteSettings();
    if (aiSettings.enabled && aiSettings.apiKey) {
      // Add AI loading placeholder at the beginning
      result.promptVariants.unshift({
        rewrittenPrompt: '',
        keyChanges: [],
        confidence: 0,
        variant: 'ai' as VariantType,
        variantLabel: 'AI 추천',
        isAiGenerated: false,
        needsSetup: false,
        isLoading: true, // New flag for async loading state
      } as RewriteResult);
      console.log('[LearningEngine] AI placeholder added (async loading enabled)');
    }

    // Enrich with history-based recommendations (Phase 2)
    const projectPath = sessionContext?.projectPath;
    const category = classification?.category;

    if (projectPath) {
      try {
        console.log('[LearningEngine] Enriching with history for project:', projectPath);
        const historyEnrichment = enrichAnalysisWithHistory(
          {
            overallScore: result.overallScore,
            goldenScores: result.goldenScores,
            issues: result.issues,
          },
          projectPath,
          category
        );
        console.log('[LearningEngine] History enrichment complete');

        result.historyRecommendations = historyEnrichment.historyRecommendations;
        result.comparisonWithHistory = historyEnrichment.comparisonWithHistory;

        if (historyEnrichment.comparisonWithHistory?.improvement) {
          console.log('[LearningEngine] History comparison:', historyEnrichment.comparisonWithHistory.improvement);
        }
      } catch (historyError) {
        console.warn('[LearningEngine] Failed to enrich with history:', historyError);
      }
    }

    // Save to history for progress tracking (with project/intent/category)
    try {
      console.log('[LearningEngine] Saving analysis to database...');
      saveAnalysis({
        promptText: text,
        overallScore: result.overallScore,
        grade: result.grade,
        goldenScores: result.goldenScores,
        issues: result.issues,
        improvedPrompt: result.improvedPrompt,
        projectPath: projectPath,
        intent: classification?.intent,
        category: category,
      });
      console.log('[LearningEngine] Database save complete');
    } catch (dbError) {
      console.warn('[LearningEngine] Failed to save to history:', dbError);
    }

    console.log('[LearningEngine] analyzePrompt COMPLETE - returning result');
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
    promptVariants: [],
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

  ipcMain.handle('get-weekly-stats', async (_event, weeks?: number) => {
    return getWeeklyStats(weeks || 4);
  });

  ipcMain.handle('get-monthly-stats', async (_event, months?: number) => {
    return getMonthlyStats(months || 6);
  });

  ipcMain.handle('get-improvement-analysis', async () => {
    return getImprovementAnalysis();
  });

  // Session context handler (active window based)
  ipcMain.handle('get-session-context', async () => {
    return getActiveWindowSessionContext();
  });

  // Legacy session context (app path based)
  ipcMain.handle('get-session-context-legacy', async () => {
    return getSessionContext();
  });

  // Session context for specific path (debugging/testing)
  ipcMain.handle('get-session-context-for-path', async (_event, targetPath: string) => {
    return getSessionContextForPath(targetPath);
  });

  // Phase 2: History-based recommendation handlers
  ipcMain.handle('get-project-patterns', async (_event, projectPath: string) => {
    return analyzeProjectPatterns(projectPath);
  });

  ipcMain.handle('get-context-recommendations', async (_event, category: string | undefined, projectPath: string | undefined) => {
    return getContextRecommendations(category, projectPath);
  });

  // Phase 3.1: Async AI variant loading handler
  ipcMain.handle('get-ai-variant', async (_event, text: string) => {
    const aiSettings = getAIRewriteSettings();
    if (!aiSettings.enabled || !aiSettings.apiKey) {
      return {
        rewrittenPrompt: '',
        keyChanges: [],
        confidence: 0,
        variant: 'ai' as VariantType,
        variantLabel: 'AI 추천',
        isAiGenerated: false,
        needsSetup: true,
      };
    }

    // Load modules if not already loaded
    if (!evaluatePromptAgainstGuidelines) {
      const loaded = await loadAnalysisModules();
      if (!loaded) {
        console.warn('[LearningEngine] Cannot generate AI variant - modules not loaded');
        return {
          rewrittenPrompt: '',
          keyChanges: [],
          confidence: 0,
          variant: 'ai' as VariantType,
          variantLabel: 'AI 추천',
          isAiGenerated: false,
          needsSetup: false,
        };
      }
    }

    try {
      // Get session context
      const capturedContext = getLastCapturedContext();
      let sessionContext: ActiveSessionContext | null = null;

      if (capturedContext?.project) {
        sessionContext = await getSessionContextForCapturedProject(capturedContext);
      } else {
        sessionContext = await getActiveWindowSessionContext();
      }

      // Run evaluation for AI variant generation
      const evaluation = evaluatePromptAgainstGuidelines!(text);

      // Create GOLDEN evaluator for multi-variant selection
      const goldenEvaluator: GOLDENEvaluator = (prompt: string) => {
        const evalResult = evaluatePromptAgainstGuidelines!(prompt);
        return {
          goal: evalResult.goldenScore.goal,
          output: evalResult.goldenScore.output,
          limits: evalResult.goldenScore.limits,
          data: evalResult.goldenScore.data,
          evaluation: evalResult.goldenScore.evaluation,
          next: evalResult.goldenScore.next,
          total: evalResult.goldenScore.total,
        };
      };

      // Generate AI variant
      const aiVariant = await generateAIVariantOnly(
        text,
        evaluation,
        sessionContext || undefined,
        aiSettings.apiKey,
        goldenEvaluator
      );

      console.log('[LearningEngine] AI variant generated:', aiVariant.isAiGenerated ? 'success' : 'fallback');
      return aiVariant;
    } catch (error) {
      console.error('[LearningEngine] AI variant generation error:', error);
      return {
        rewrittenPrompt: '',
        keyChanges: [],
        confidence: 0,
        variant: 'ai' as VariantType,
        variantLabel: 'AI 추천',
        isAiGenerated: false,
        needsSetup: false,
      };
    }
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
