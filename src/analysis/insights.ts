/**
 * Insights Generator
 * Generates actionable insights from conversation analysis
 */

import {
  classifyPrompt,
  getCategoryLabel,
  type TaskCategory,
  type ClassificationResult,
} from './classifier.js';
import {
  calculatePromptQuality,
  analyzeClassificationPatterns,
  type PromptQualityScore,
  type ClassificationInsights,
} from './scorer.js';
import {
  buildPromptLibrary,
  type PromptLibrary,
  type PromptLibraryEntry,
  type PromptDataForLibrary,
} from './prompt-library.js';
import {
  evaluatePromptsAgainstGuidelines,
  type GuidelinesSummary,
  type GOLDENScore,
} from './guidelines-evaluator.js';
import {
  generateSelfImprovementFeedback,
  type SelfImprovementFeedback,
  type PromptDataForImprovement,
} from './self-improvement.js';

/**
 * Time period for filtering
 */
export type TimePeriod = '7d' | '30d' | '90d' | 'all';

/**
 * Insight severity
 */
export type InsightSeverity = 'critical' | 'warning' | 'info' | 'success';

/**
 * Individual insight
 */
export interface Insight {
  id: string;
  severity: InsightSeverity;
  category: 'problem' | 'improvement' | 'strength';
  title: string;
  description: string;
  evidence: string[];
  recommendations: string[];
  affectedCategory?: TaskCategory;
  goldenDimension?: 'goal' | 'output' | 'limits' | 'data' | 'evaluation' | 'next';
  metric?: {
    name: string;
    value: number;
    threshold: number;
    unit: string;
  };
}

/**
 * Insights report
 */
export interface InsightsReport {
  generatedAt: Date;
  period: TimePeriod;
  summary: {
    totalConversations: number;
    totalPrompts: number;
    overallEffectiveness: number;
    overallQuality: number;
  };
  problems: Insight[];
  improvements: Insight[];
  strengths: Insight[];
  categoryBreakdown: CategoryInsight[];
  recommendations: PrioritizedRecommendation[];
  // 신규 필드: 프롬프트 라이브러리, 가이드라인 평가, 자기 개선 피드백
  promptLibrary?: PromptLibrary;
  guidelinesSummary?: GuidelinesSummary;
  selfImprovement?: SelfImprovementFeedback;
}

// Re-export for convenience
export type {
  PromptLibrary,
  PromptLibraryEntry,
  GuidelinesSummary,
  GOLDENScore,
  SelfImprovementFeedback,
};

/**
 * Category-specific insight
 */
export interface CategoryInsight {
  category: TaskCategory;
  count: number;
  percentage: number;
  avgEffectiveness: number;
  trend: 'improving' | 'declining' | 'stable';
  topIssue?: string;
}

/**
 * Prioritized recommendation
 */
export interface PrioritizedRecommendation {
  priority: number; // 1 = highest
  title: string;
  description: string;
  expectedImpact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'moderate' | 'hard';
  relatedInsights: string[]; // insight IDs
}

/**
 * Prompt data for analysis
 */
export interface PromptData {
  content: string;
  conversationId: string;
  timestamp?: Date;
  effectiveness?: number;
}

/**
 * Generate insights from prompts
 */
export function generateInsights(
  prompts: PromptData[],
  options: {
    period?: TimePeriod;
    category?: TaskCategory;
    focusArea?: 'problems' | 'improvements' | 'strengths';
    includeLibrary?: boolean;
    includeGuidelines?: boolean;
    includeSelfImprovement?: boolean;
  } = {}
): InsightsReport {
  const {
    period = 'all',
    category,
    focusArea,
    includeLibrary = true,
    includeGuidelines = true,
    includeSelfImprovement = true,
  } = options;

  // Filter by period if needed
  const filteredPrompts = filterByPeriod(prompts, period);

  // Classify all prompts
  const classifications = filteredPrompts.map((p) => ({
    ...p,
    classification: classifyPrompt(p.content),
    quality: calculatePromptQuality(classifyPrompt(p.content)),
  }));

  // Filter by category if specified
  const targetPrompts = category
    ? classifications.filter((c) => c.classification.taskCategory === category)
    : classifications;

  if (targetPrompts.length === 0) {
    return createEmptyReport(period);
  }

  // Analyze patterns
  const patterns = analyzeClassificationPatterns(
    targetPrompts.map((p) => p.content)
  );

  // Generate insights
  const problems = detectProblems(targetPrompts, patterns);
  const improvements = detectImprovements(targetPrompts, patterns);
  const strengths = detectStrengths(targetPrompts, patterns);

  // Category breakdown
  const categoryBreakdown = generateCategoryBreakdown(classifications);

  // Calculate summary
  const avgEffectiveness =
    targetPrompts.reduce((sum, p) => sum + (p.effectiveness || 0.5), 0) /
    targetPrompts.length;
  const avgQuality =
    targetPrompts.reduce((sum, p) => sum + p.quality.overall, 0) /
    targetPrompts.length;

  // Generate prioritized recommendations
  const recommendations = generateRecommendations(
    problems,
    improvements,
    patterns
  );

  // 프롬프트 라이브러리 구축
  let promptLibrary: PromptLibrary | undefined;
  if (includeLibrary) {
    const libraryData: PromptDataForLibrary[] = targetPrompts.map((p) => ({
      content: p.content,
      conversationId: p.conversationId,
      timestamp: p.timestamp || new Date(),
      effectiveness: p.effectiveness || 0.5,
    }));
    promptLibrary = buildPromptLibrary(libraryData);
  }

  // 가이드라인 평가
  let guidelinesSummary: GuidelinesSummary | undefined;
  if (includeGuidelines) {
    const texts = targetPrompts.map((p) => p.content);
    const guidelinesResult = evaluatePromptsAgainstGuidelines(texts);
    guidelinesSummary = guidelinesResult.summary;
  }

  // 자기 개선 피드백
  let selfImprovement: SelfImprovementFeedback | undefined;
  if (includeSelfImprovement) {
    const improvementData: PromptDataForImprovement[] = targetPrompts.map((p) => ({
      content: p.content,
      conversationId: p.conversationId,
      timestamp: p.timestamp || new Date(),
      effectiveness: p.effectiveness || 0.5,
    }));
    selfImprovement = generateSelfImprovementFeedback(improvementData);
  }

  // Apply focus filter
  const report: InsightsReport = {
    generatedAt: new Date(),
    period,
    summary: {
      totalConversations: new Set(targetPrompts.map((p) => p.conversationId))
        .size,
      totalPrompts: targetPrompts.length,
      overallEffectiveness: avgEffectiveness,
      overallQuality: avgQuality,
    },
    problems: focusArea === 'strengths' ? [] : problems,
    improvements:
      focusArea === 'problems' || focusArea === 'strengths'
        ? []
        : improvements,
    strengths: focusArea === 'problems' ? [] : strengths,
    categoryBreakdown,
    recommendations,
    promptLibrary,
    guidelinesSummary,
    selfImprovement,
  };

  return report;
}

/**
 * Filter prompts by time period
 */
function filterByPeriod(
  prompts: PromptData[],
  period: TimePeriod
): PromptData[] {
  if (period === 'all') return prompts;

  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return prompts.filter((p) => !p.timestamp || p.timestamp >= cutoff);
}

/**
 * Create empty report
 */
function createEmptyReport(period: TimePeriod): InsightsReport {
  return {
    generatedAt: new Date(),
    period,
    summary: {
      totalConversations: 0,
      totalPrompts: 0,
      overallEffectiveness: 0,
      overallQuality: 0,
    },
    problems: [],
    improvements: [],
    strengths: [],
    categoryBreakdown: [],
    recommendations: [],
  };
}

/**
 * Detect problems from analysis
 */
function detectProblems(
  prompts: Array<{
    content: string;
    classification: ClassificationResult;
    quality: PromptQualityScore;
    effectiveness?: number;
  }>,
  patterns: ClassificationInsights
): Insight[] {
  const problems: Insight[] = [];
  let insightId = 1;

  // Problem: High retry rate / low effectiveness
  const lowEffectiveness = prompts.filter(
    (p) => (p.effectiveness || 0.5) < 0.4
  );
  if (lowEffectiveness.length > prompts.length * 0.2) {
    problems.push({
      id: `problem-${insightId++}`,
      severity: 'warning',
      category: 'problem',
      title: '낮은 효과성 비율이 높음',
      description: `전체 프롬프트 중 ${((lowEffectiveness.length / prompts.length) * 100).toFixed(1)}%가 낮은 효과성을 보입니다.`,
      evidence: lowEffectiveness
        .slice(0, 3)
        .map((p) => `"${p.content.slice(0, 50)}..."`),
      recommendations: [
        '요구사항을 더 구체적으로 작성하세요',
        '컨텍스트와 예시를 포함하세요',
      ],
      metric: {
        name: '저효과성 비율',
        value: lowEffectiveness.length / prompts.length,
        threshold: 0.2,
        unit: '%',
      },
    });
  }

  // Problem: Too many unknown categories
  const unknownCount = prompts.filter(
    (p) => p.classification.taskCategory === 'unknown'
  ).length;
  if (unknownCount > prompts.length * 0.3) {
    problems.push({
      id: `problem-${insightId++}`,
      severity: 'warning',
      category: 'problem',
      title: '작업 유형 불명확',
      description: `${((unknownCount / prompts.length) * 100).toFixed(1)}%의 프롬프트가 작업 유형을 파악하기 어렵습니다.`,
      evidence: prompts
        .filter((p) => p.classification.taskCategory === 'unknown')
        .slice(0, 3)
        .map((p) => `"${p.content.slice(0, 50)}..."`),
      recommendations: [
        '작업 유형을 명시하세요 (예: "버그 수정:", "리팩토링:")',
        '구체적인 동사를 사용하세요 (생성, 수정, 분석 등)',
      ],
    });
  }

  // Problem: Low clarity
  const avgClarity = patterns.averageQuality.clarity;
  if (avgClarity < 0.5) {
    problems.push({
      id: `problem-${insightId++}`,
      severity: 'critical',
      category: 'problem',
      title: '프롬프트 명확성 부족',
      description: '평균 명확성 점수가 낮습니다. AI가 의도를 파악하기 어려울 수 있습니다.',
      evidence: [],
      recommendations: [
        '한 프롬프트에 하나의 명확한 요청만 포함하세요',
        '모호한 표현을 피하세요',
        '구체적인 키워드를 사용하세요',
      ],
      goldenDimension: 'goal',
      metric: {
        name: '평균 명확성',
        value: avgClarity,
        threshold: 0.5,
        unit: '점',
      },
    });
  }

  // Problem: Low context
  const avgContext = patterns.averageQuality.context;
  if (avgContext < 0.4) {
    problems.push({
      id: `problem-${insightId++}`,
      severity: 'warning',
      category: 'problem',
      title: '컨텍스트 부족',
      description: '프롬프트에 배경 정보나 참조가 부족합니다.',
      evidence: [],
      recommendations: [
        '관련 코드 블록을 포함하세요',
        '파일 경로를 명시하세요',
        '이전 대화의 컨텍스트를 언급하세요',
      ],
      goldenDimension: 'data',
      metric: {
        name: '평균 컨텍스트',
        value: avgContext,
        threshold: 0.4,
        unit: '점',
      },
    });
  }

  return problems;
}

/**
 * Detect improvement opportunities
 */
function detectImprovements(
  prompts: Array<{
    content: string;
    classification: ClassificationResult;
    quality: PromptQualityScore;
  }>,
  patterns: ClassificationInsights
): Insight[] {
  const improvements: Insight[] = [];
  let insightId = 1;

  // Improvement: Balance command/question ratio
  const commandRatio =
    patterns.intentDistribution.command / prompts.length;
  if (commandRatio > 0.8) {
    improvements.push({
      id: `improvement-${insightId++}`,
      severity: 'info',
      category: 'improvement',
      title: '질문형 프롬프트 활용',
      description: '명령형 프롬프트가 대부분입니다. 때로는 AI의 제안을 먼저 받아보세요.',
      evidence: [],
      recommendations: [
        '"이 문제를 어떻게 해결하면 좋을까요?" 형식 활용',
        '"다른 접근 방법이 있을까요?" 로 대안 탐색',
      ],
    });
  }

  // Improvement: Add more context
  const lowContextPrompts = prompts.filter((p) => p.quality.context < 0.3);
  if (lowContextPrompts.length > prompts.length * 0.5) {
    improvements.push({
      id: `improvement-${insightId++}`,
      severity: 'info',
      category: 'improvement',
      title: '컨텍스트 풍부화',
      description: '많은 프롬프트에 배경 정보가 부족합니다.',
      evidence: lowContextPrompts
        .slice(0, 2)
        .map((p) => `"${p.content.slice(0, 40)}..."`),
      recommendations: [
        '코드 스니펫을 포함하세요',
        '에러 메시지가 있다면 함께 첨부하세요',
        '원하는 결과물의 예시를 제공하세요',
      ],
      goldenDimension: 'data',
    });
  }

  // Improvement: Use templates for common tasks
  const topCategory = patterns.dominantCategory;
  if (topCategory !== 'unknown' && patterns.categoryDistribution[topCategory] > prompts.length * 0.3) {
    improvements.push({
      id: `improvement-${insightId++}`,
      severity: 'info',
      category: 'improvement',
      title: `${getCategoryLabel(topCategory)} 템플릿 활용`,
      description: `자주 수행하는 ${getCategoryLabel(topCategory)} 작업에 템플릿을 만들어보세요.`,
      evidence: [],
      recommendations: [
        '반복되는 패턴을 템플릿으로 저장하세요',
        '성공적인 프롬프트를 재사용하세요',
      ],
      affectedCategory: topCategory,
    });
  }

  return improvements;
}

/**
 * Detect strengths
 */
function detectStrengths(
  prompts: Array<{
    content: string;
    classification: ClassificationResult;
    quality: PromptQualityScore;
    effectiveness?: number;
  }>,
  patterns: ClassificationInsights
): Insight[] {
  const strengths: Insight[] = [];
  let insightId = 1;

  // Strength: High effectiveness
  const highEffectiveness = prompts.filter(
    (p) => (p.effectiveness || 0.5) >= 0.8
  );
  if (highEffectiveness.length > prompts.length * 0.3) {
    strengths.push({
      id: `strength-${insightId++}`,
      severity: 'success',
      category: 'strength',
      title: '높은 효과성 달성',
      description: `${((highEffectiveness.length / prompts.length) * 100).toFixed(1)}%의 프롬프트가 높은 효과성을 보입니다.`,
      evidence: highEffectiveness
        .slice(0, 2)
        .map((p) => `"${p.content.slice(0, 50)}..."`),
      recommendations: ['이 패턴을 계속 유지하세요', '성공 패턴을 템플릿화하세요'],
    });
  }

  // Strength: Good clarity
  if (patterns.averageQuality.clarity >= 0.7) {
    strengths.push({
      id: `strength-${insightId++}`,
      severity: 'success',
      category: 'strength',
      title: '명확한 프롬프트 작성',
      description: '프롬프트가 명확하고 이해하기 쉽습니다.',
      evidence: [],
      recommendations: ['현재 스타일을 유지하세요'],
      metric: {
        name: '평균 명확성',
        value: patterns.averageQuality.clarity,
        threshold: 0.7,
        unit: '점',
      },
    });
  }

  // Strength: Good context
  if (patterns.averageQuality.context >= 0.6) {
    strengths.push({
      id: `strength-${insightId++}`,
      severity: 'success',
      category: 'strength',
      title: '풍부한 컨텍스트 제공',
      description: '배경 정보와 참조를 잘 제공하고 있습니다.',
      evidence: [],
      recommendations: ['이 습관을 유지하세요'],
    });
  }

  // Strength: Diverse task types
  const usedCategories = Object.entries(patterns.categoryDistribution).filter(
    ([, count]) => count > 0
  ).length;
  if (usedCategories >= 4) {
    strengths.push({
      id: `strength-${insightId++}`,
      severity: 'success',
      category: 'strength',
      title: '다양한 작업 유형 활용',
      description: `${usedCategories}가지 다양한 작업 유형에 AI를 활용하고 있습니다.`,
      evidence: [],
      recommendations: ['다양한 활용을 계속하세요'],
    });
  }

  return strengths;
}

/**
 * Generate category breakdown
 */
function generateCategoryBreakdown(
  prompts: Array<{
    classification: ClassificationResult;
    effectiveness?: number;
  }>
): CategoryInsight[] {
  const categoryMap = new Map<
    TaskCategory,
    { count: number; totalEffectiveness: number }
  >();

  for (const p of prompts) {
    const cat = p.classification.taskCategory;
    const current = categoryMap.get(cat) || { count: 0, totalEffectiveness: 0 };
    categoryMap.set(cat, {
      count: current.count + 1,
      totalEffectiveness: current.totalEffectiveness + (p.effectiveness || 0.5),
    });
  }

  const total = prompts.length;
  const insights: CategoryInsight[] = [];

  for (const [category, data] of categoryMap) {
    if (data.count > 0) {
      insights.push({
        category,
        count: data.count,
        percentage: (data.count / total) * 100,
        avgEffectiveness: data.totalEffectiveness / data.count,
        trend: 'stable', // Would need historical data for real trend
        topIssue: undefined,
      });
    }
  }

  // Sort by count
  insights.sort((a, b) => b.count - a.count);

  return insights;
}

/**
 * Generate prioritized recommendations
 */
function generateRecommendations(
  problems: Insight[],
  improvements: Insight[],
  patterns: ClassificationInsights
): PrioritizedRecommendation[] {
  const recommendations: PrioritizedRecommendation[] = [];
  let priority = 1;

  // Critical problems first
  const criticalProblems = problems.filter((p) => p.severity === 'critical');
  for (const problem of criticalProblems) {
    recommendations.push({
      priority: priority++,
      title: problem.title,
      description: problem.recommendations[0] || problem.description,
      expectedImpact: 'high',
      effort: 'easy',
      relatedInsights: [problem.id],
    });
  }

  // Warning problems
  const warningProblems = problems.filter((p) => p.severity === 'warning');
  for (const problem of warningProblems.slice(0, 2)) {
    recommendations.push({
      priority: priority++,
      title: problem.title,
      description: problem.recommendations[0] || problem.description,
      expectedImpact: 'medium',
      effort: 'moderate',
      relatedInsights: [problem.id],
    });
  }

  // Top improvements
  for (const improvement of improvements.slice(0, 2)) {
    recommendations.push({
      priority: priority++,
      title: improvement.title,
      description: improvement.recommendations[0] || improvement.description,
      expectedImpact: 'medium',
      effort: 'easy',
      relatedInsights: [improvement.id],
    });
  }

  // Add pattern-based recommendations
  if (patterns.recommendations.length > 0) {
    recommendations.push({
      priority: priority++,
      title: '분류 기반 개선',
      description: patterns.recommendations[0],
      expectedImpact: 'medium',
      effort: 'easy',
      relatedInsights: [],
    });
  }

  return recommendations;
}

/**
 * Format insight for display
 */
export function formatInsight(insight: Insight): string {
  const severityIcon =
    insight.severity === 'critical'
      ? '🔴'
      : insight.severity === 'warning'
        ? '🟡'
        : insight.severity === 'success'
          ? '🟢'
          : 'ℹ️';

  let output = `${severityIcon} ${insight.title}\n`;
  output += `   ${insight.description}\n`;

  if (insight.metric) {
    output += `   📊 ${insight.metric.name}: ${(insight.metric.value * 100).toFixed(1)}${insight.metric.unit}\n`;
  }

  if (insight.evidence.length > 0) {
    output += `   📝 예시:\n`;
    insight.evidence.forEach((e) => {
      output += `      - ${e}\n`;
    });
  }

  if (insight.recommendations.length > 0) {
    output += `   💡 권장:\n`;
    insight.recommendations.forEach((r) => {
      output += `      → ${r}\n`;
    });
  }

  return output;
}

/**
 * Format full report
 */
export function formatReport(report: InsightsReport): string {
  let output = '';

  // Header
  output += '═'.repeat(60) + '\n';
  output += '📊 Prompt Evolution 인사이트 리포트\n';
  output += '═'.repeat(60) + '\n\n';

  // Summary
  output += `📅 기간: ${report.period === 'all' ? '전체' : report.period}\n`;
  output += `📅 생성: ${report.generatedAt.toLocaleString()}\n\n`;

  output += '📈 요약\n';
  output += '─'.repeat(40) + '\n';
  output += `총 대화: ${report.summary.totalConversations}개\n`;
  output += `총 프롬프트: ${report.summary.totalPrompts}개\n`;
  output += `평균 효과성: ${(report.summary.overallEffectiveness * 100).toFixed(1)}%\n`;
  output += `평균 품질: ${(report.summary.overallQuality * 100).toFixed(1)}%\n\n`;

  // Problems
  if (report.problems.length > 0) {
    output += '🔴 문제점\n';
    output += '─'.repeat(40) + '\n';
    report.problems.forEach((p) => {
      output += formatInsight(p) + '\n';
    });
  }

  // Improvements
  if (report.improvements.length > 0) {
    output += '🟡 개선 기회\n';
    output += '─'.repeat(40) + '\n';
    report.improvements.forEach((p) => {
      output += formatInsight(p) + '\n';
    });
  }

  // Strengths
  if (report.strengths.length > 0) {
    output += '🟢 강점\n';
    output += '─'.repeat(40) + '\n';
    report.strengths.forEach((p) => {
      output += formatInsight(p) + '\n';
    });
  }

  // Category breakdown
  if (report.categoryBreakdown.length > 0) {
    output += '📂 카테고리별 분석\n';
    output += '─'.repeat(40) + '\n';
    report.categoryBreakdown.slice(0, 5).forEach((c) => {
      const bar = '█'.repeat(Math.round(c.percentage / 5));
      output += `${getCategoryLabel(c.category)}: ${c.count}개 (${c.percentage.toFixed(1)}%) ${bar}\n`;
      output += `   효과성: ${(c.avgEffectiveness * 100).toFixed(1)}%\n`;
    });
    output += '\n';
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    output += '💡 우선순위 권장사항\n';
    output += '─'.repeat(40) + '\n';
    report.recommendations.slice(0, 5).forEach((r, i) => {
      const impactIcon =
        r.expectedImpact === 'high' ? '⬆️' : r.expectedImpact === 'medium' ? '➡️' : '⬇️';
      output += `${i + 1}. ${r.title} ${impactIcon}\n`;
      output += `   ${r.description}\n`;
    });
  }

  return output;
}
