/**
 * Effectiveness Scorer
 * Calculates effectiveness scores for conversations
 */

import type { ConversationSignals } from './signal-detector.js';
import {
  classifyPrompt,
  type ClassificationResult,
  type PromptIntent,
  type TaskCategory,
} from './classifier.js';
import {
  EFFECTIVENESS_WEIGHTS as CONFIG_EFFECTIVENESS_WEIGHTS,
  GRADE_THRESHOLDS,
  QUALITY_WEIGHTS,
  FEATURE_THRESHOLDS,
  SCORER_THRESHOLDS,
  COMPARISON_THRESHOLDS,
} from '../shared/config/index.js';

/**
 * Effectiveness score components
 */
export interface EffectivenessComponents {
  // Core scores (0-1)
  sentimentScore: number; // Based on positive/negative feedback ratio
  completionScore: number; // Task completion indicators
  efficiencyScore: number; // Based on retry rate (lower = better)
  engagementScore: number; // Based on interaction patterns

  // Final score
  overall: number; // Weighted combination (0-1)
}

/**
 * Weights for effectiveness calculation
 * Re-exported from central config for backward compatibility
 */
export const EFFECTIVENESS_WEIGHTS = CONFIG_EFFECTIVENESS_WEIGHTS;

/**
 * Calculate effectiveness score from conversation signals
 */
export function calculateEffectiveness(
  signals: ConversationSignals
): EffectivenessComponents {
  const { summary } = signals;

  // 1. Sentiment Score (convert from -1..1 to 0..1)
  const sentimentScore = (summary.sentimentScore + 1) / 2;

  // 2. Completion Score
  const completionScore = summary.hasCompletion ? 1.0 : 0.5;

  // 3. Efficiency Score (inverse of retry rate)
  const efficiencyScore = Math.max(0, 1 - summary.retryRate * 2);

  // 4. Engagement Score (based on question/command balance)
  const totalInteractions =
    summary.questionCount + summary.commandCount + summary.contextCount;
  const engagementScore =
    totalInteractions > 0
      ? Math.min(
          (summary.contextCount / totalInteractions) * 0.5 +
            (summary.commandCount / totalInteractions) * 0.3 +
            (summary.questionCount / totalInteractions) * 0.2,
          1.0
        )
      : 0.5;

  // Calculate weighted overall score
  const overall =
    sentimentScore * EFFECTIVENESS_WEIGHTS.sentiment +
    completionScore * EFFECTIVENESS_WEIGHTS.completion +
    efficiencyScore * EFFECTIVENESS_WEIGHTS.efficiency +
    engagementScore * EFFECTIVENESS_WEIGHTS.engagement;

  return {
    sentimentScore,
    completionScore,
    efficiencyScore,
    engagementScore,
    overall,
  };
}

/**
 * Get effectiveness grade from score
 */
export type EffectivenessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function getGrade(score: number): EffectivenessGrade {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

/**
 * Get grade description
 */
export function getGradeDescription(grade: EffectivenessGrade): string {
  switch (grade) {
    case 'A':
      return '매우 효과적 - 명확한 소통과 높은 성공률';
    case 'B':
      return '효과적 - 원활한 진행과 좋은 결과';
    case 'C':
      return '보통 - 개선 여지 있음';
    case 'D':
      return '비효율적 - 재시도 많음 또는 불만족';
    case 'F':
      return '매우 비효율적 - 상당한 개선 필요';
  }
}

/**
 * Detailed effectiveness analysis
 */
export interface EffectivenessAnalysis {
  score: EffectivenessComponents;
  grade: EffectivenessGrade;
  gradeDescription: string;
  insights: string[];
  recommendations: string[];
}

/**
 * Generate full effectiveness analysis
 */
export function analyzeEffectiveness(
  signals: ConversationSignals
): EffectivenessAnalysis {
  const score = calculateEffectiveness(signals);
  const grade = getGrade(score.overall);
  const gradeDescription = getGradeDescription(grade);

  const insights: string[] = [];
  const recommendations: string[] = [];

  // Generate insights based on scores
  if (score.sentimentScore >= SCORER_THRESHOLDS.POSITIVE_SENTIMENT) {
    insights.push('긍정적인 피드백이 많음');
  } else if (score.sentimentScore <= SCORER_THRESHOLDS.NEGATIVE_SENTIMENT) {
    insights.push('부정적인 피드백이 많음');
    recommendations.push('프롬프트를 더 명확하게 작성해보세요');
  }

  if (score.efficiencyScore < SCORER_THRESHOLDS.LOW_EFFICIENCY) {
    insights.push('재시도가 많았음');
    recommendations.push('요구사항을 한 번에 명확히 전달해보세요');
    recommendations.push('구체적인 예시를 포함하면 정확도가 높아집니다');
  }

  if (!signals.summary.hasCompletion) {
    insights.push('명시적인 작업 완료 확인 없음');
    recommendations.push('작업 완료 시 명시적으로 확인하면 대화 품질 추적에 도움됩니다');
  }

  if (signals.summary.contextCount === 0) {
    insights.push('컨텍스트 제공이 부족함');
    recommendations.push('배경 정보나 요구사항을 먼저 설명하면 더 정확한 응답을 받을 수 있습니다');
  }

  if (signals.summary.questionCount > signals.summary.commandCount * 2) {
    insights.push('질문 비율이 높음');
  }

  // Add grade-specific insights
  if (grade === 'A') {
    insights.push('효과적인 프롬프팅 패턴을 보여줌');
  } else if (grade === 'F') {
    insights.push('대화 패턴 개선이 필요함');
    recommendations.push('성공적인 프롬프트 템플릿을 참고해보세요');
  }

  return {
    score,
    grade,
    gradeDescription,
    insights,
    recommendations,
  };
}

/**
 * Compare effectiveness between two conversations
 */
export interface EffectivenessComparison {
  conversation1Id: string;
  conversation2Id: string;
  score1: number;
  score2: number;
  difference: number;
  winner: 'conversation1' | 'conversation2' | 'tie';
  insights: string[];
}

export function compareEffectiveness(
  signals1: ConversationSignals,
  signals2: ConversationSignals
): EffectivenessComparison {
  const eff1 = calculateEffectiveness(signals1);
  const eff2 = calculateEffectiveness(signals2);

  const difference = eff1.overall - eff2.overall;
  const winner =
    Math.abs(difference) < COMPARISON_THRESHOLDS.TIE_DIFFERENCE
      ? 'tie'
      : difference > 0
        ? 'conversation1'
        : 'conversation2';

  const insights: string[] = [];

  if (Math.abs(eff1.sentimentScore - eff2.sentimentScore) > COMPARISON_THRESHOLDS.SIGNIFICANT_DIFFERENCE) {
    insights.push(
      `감정 점수 차이: ${eff1.sentimentScore > eff2.sentimentScore ? '첫 번째' : '두 번째'} 대화가 더 긍정적`
    );
  }

  if (Math.abs(eff1.efficiencyScore - eff2.efficiencyScore) > COMPARISON_THRESHOLDS.SIGNIFICANT_DIFFERENCE) {
    insights.push(
      `효율성 차이: ${eff1.efficiencyScore > eff2.efficiencyScore ? '첫 번째' : '두 번째'} 대화가 더 효율적`
    );
  }

  return {
    conversation1Id: signals1.conversationId,
    conversation2Id: signals2.conversationId,
    score1: eff1.overall,
    score2: eff2.overall,
    difference,
    winner,
    insights,
  };
}

/**
 * Calculate aggregate effectiveness for multiple conversations
 */
export interface AggregateEffectiveness {
  totalConversations: number;
  averageScore: number;
  averageGrade: EffectivenessGrade;
  scoreDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  trends: {
    mostCommonIssue: string | null;
    strongestArea: string | null;
  };
}

export function calculateAggregateEffectiveness(
  allSignals: ConversationSignals[]
): AggregateEffectiveness {
  if (allSignals.length === 0) {
    return {
      totalConversations: 0,
      averageScore: 0,
      averageGrade: 'F',
      scoreDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      trends: { mostCommonIssue: null, strongestArea: null },
    };
  }

  const scores = allSignals.map((s) => calculateEffectiveness(s));
  const averageScore =
    scores.reduce((sum, s) => sum + s.overall, 0) / scores.length;

  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach((s) => {
    distribution[getGrade(s.overall)]++;
  });

  // Find trends
  const avgSentiment =
    scores.reduce((sum, s) => sum + s.sentimentScore, 0) / scores.length;
  const avgEfficiency =
    scores.reduce((sum, s) => sum + s.efficiencyScore, 0) / scores.length;
  const avgCompletion =
    scores.reduce((sum, s) => sum + s.completionScore, 0) / scores.length;
  const avgEngagement =
    scores.reduce((sum, s) => sum + s.engagementScore, 0) / scores.length;

  const areas = [
    { name: '감정', score: avgSentiment },
    { name: '효율성', score: avgEfficiency },
    { name: '완료', score: avgCompletion },
    { name: '참여', score: avgEngagement },
  ];

  areas.sort((a, b) => b.score - a.score);
  const strongestArea = areas[0].score > SCORER_THRESHOLDS.STRENGTH_AREA_THRESHOLD ? areas[0].name : null;

  areas.sort((a, b) => a.score - b.score);
  const mostCommonIssue = areas[0].score < SCORER_THRESHOLDS.WEAKNESS_AREA_THRESHOLD ? areas[0].name : null;

  return {
    totalConversations: allSignals.length,
    averageScore,
    averageGrade: getGrade(averageScore),
    scoreDistribution: distribution,
    trends: {
      mostCommonIssue,
      strongestArea,
    },
  };
}

/**
 * Enhanced prompt quality score
 */
export interface PromptQualityScore {
  clarity: number; // How clear/specific the prompt is (0-1)
  structure: number; // Structure quality based on classification confidence (0-1)
  context: number; // Context richness (0-1)
  overall: number; // Combined score (0-1)
}

/**
 * Calculate prompt quality score from classification
 */
export function calculatePromptQuality(
  classification: ClassificationResult
): PromptQualityScore {
  const { features, intentConfidence, categoryConfidence } = classification;

  // Clarity: Based on classification confidence
  const clarity = (intentConfidence + categoryConfidence) / 2;

  // Structure: Based on features indicating well-structured prompt
  let structure = 0.5; // Base score
  if (features.complexity === 'moderate') structure += 0.2;
  if (features.complexity === 'complex') structure += 0.1; // Too complex can be bad
  if (features.hasCodeBlock) structure += 0.1; // Code examples are good
  if (features.hasFilePath) structure += 0.1; // Specific references are good
  if (
    features.wordCount >= FEATURE_THRESHOLDS.MIN_GOOD_WORD_COUNT &&
    features.wordCount <= FEATURE_THRESHOLDS.MAX_GOOD_WORD_COUNT
  ) {
    structure += 0.1;
  }
  structure = Math.min(1, structure);

  // Context: Based on features suggesting context-rich prompt
  let context = 0.3; // Base score
  if (features.hasCodeBlock) context += 0.2;
  if (features.hasFilePath) context += 0.2;
  if (features.hasUrl) context += 0.1;
  if (features.wordCount > FEATURE_THRESHOLDS.MIN_CONTEXT_WORD_COUNT) context += 0.1;
  if (features.complexity !== 'simple') context += 0.1;
  context = Math.min(1, context);

  // Overall weighted score
  const overall =
    clarity * QUALITY_WEIGHTS.clarity +
    structure * QUALITY_WEIGHTS.structure +
    context * QUALITY_WEIGHTS.context;

  return {
    clarity,
    structure,
    context,
    overall,
  };
}

/**
 * Classification insights for a conversation
 */
export interface ClassificationInsights {
  dominantIntent: PromptIntent;
  dominantCategory: TaskCategory;
  intentDistribution: Record<PromptIntent, number>;
  categoryDistribution: Record<TaskCategory, number>;
  averageQuality: PromptQualityScore;
  recommendations: string[];
}

/**
 * Analyze classification patterns for multiple prompts
 */
export function analyzeClassificationPatterns(
  prompts: string[]
): ClassificationInsights {
  if (prompts.length === 0) {
    return {
      dominantIntent: 'unknown',
      dominantCategory: 'unknown',
      intentDistribution: {
        command: 0,
        question: 0,
        instruction: 0,
        feedback: 0,
        context: 0,
        clarification: 0,
        unknown: 0,
      },
      categoryDistribution: {
        'code-generation': 0,
        'code-review': 0,
        'bug-fix': 0,
        refactoring: 0,
        explanation: 0,
        documentation: 0,
        testing: 0,
        architecture: 0,
        deployment: 0,
        'data-analysis': 0,
        general: 0,
        unknown: 0,
      },
      averageQuality: { clarity: 0, structure: 0, context: 0, overall: 0 },
      recommendations: [],
    };
  }

  // Classify all prompts
  const classifications = prompts.map((p) => classifyPrompt(p));
  const qualities = classifications.map((c) => calculatePromptQuality(c));

  // Calculate distributions
  const intentDistribution: Record<PromptIntent, number> = {
    command: 0,
    question: 0,
    instruction: 0,
    feedback: 0,
    context: 0,
    clarification: 0,
    unknown: 0,
  };

  const categoryDistribution: Record<TaskCategory, number> = {
    'code-generation': 0,
    'code-review': 0,
    'bug-fix': 0,
    refactoring: 0,
    explanation: 0,
    documentation: 0,
    testing: 0,
    architecture: 0,
    deployment: 0,
    'data-analysis': 0,
    general: 0,
    unknown: 0,
  };

  for (const c of classifications) {
    intentDistribution[c.intent]++;
    categoryDistribution[c.taskCategory]++;
  }

  // Find dominant patterns
  let maxIntent: PromptIntent = 'unknown';
  let maxIntentCount = 0;
  for (const [intent, count] of Object.entries(intentDistribution)) {
    if (count > maxIntentCount) {
      maxIntentCount = count;
      maxIntent = intent as PromptIntent;
    }
  }

  let maxCategory: TaskCategory = 'unknown';
  let maxCategoryCount = 0;
  for (const [category, count] of Object.entries(categoryDistribution)) {
    if (count > maxCategoryCount) {
      maxCategoryCount = count;
      maxCategory = category as TaskCategory;
    }
  }

  // Calculate average quality
  const avgQuality: PromptQualityScore = {
    clarity: qualities.reduce((s, q) => s + q.clarity, 0) / qualities.length,
    structure: qualities.reduce((s, q) => s + q.structure, 0) / qualities.length,
    context: qualities.reduce((s, q) => s + q.context, 0) / qualities.length,
    overall: qualities.reduce((s, q) => s + q.overall, 0) / qualities.length,
  };

  // Generate recommendations
  const recommendations: string[] = [];

  if (avgQuality.clarity < SCORER_THRESHOLDS.CLARITY_RECOMMENDATION) {
    recommendations.push('프롬프트를 더 명확하고 구체적으로 작성해보세요');
  }

  if (avgQuality.context < SCORER_THRESHOLDS.CONTEXT_RECOMMENDATION) {
    recommendations.push('배경 정보나 코드 예시를 포함하면 더 정확한 응답을 받을 수 있습니다');
  }

  if (categoryDistribution.unknown > prompts.length * SCORER_THRESHOLDS.UNKNOWN_TYPE_RATIO) {
    recommendations.push('작업 유형을 명시적으로 언급하면 AI가 더 적절한 응답을 할 수 있습니다');
  }

  if (intentDistribution.command > prompts.length * SCORER_THRESHOLDS.COMMAND_DOMINANCE_RATIO) {
    recommendations.push('때로는 질문형 프롬프트로 AI의 제안을 먼저 받아보세요');
  }

  return {
    dominantIntent: maxIntent,
    dominantCategory: maxCategory,
    intentDistribution,
    categoryDistribution,
    averageQuality: avgQuality,
    recommendations,
  };
}

/**
 * Enhanced effectiveness with classification
 */
export interface EnhancedEffectivenessAnalysis extends EffectivenessAnalysis {
  classificationInsights?: ClassificationInsights;
  qualityScore?: PromptQualityScore;
}

/**
 * Generate enhanced effectiveness analysis with classification
 */
export function analyzeEnhancedEffectiveness(
  signals: ConversationSignals,
  userPrompts?: string[]
): EnhancedEffectivenessAnalysis {
  const baseAnalysis = analyzeEffectiveness(signals);

  if (!userPrompts || userPrompts.length === 0) {
    return baseAnalysis;
  }

  const classificationInsights = analyzeClassificationPatterns(userPrompts);

  // Combine recommendations
  const combinedRecommendations = [
    ...baseAnalysis.recommendations,
    ...classificationInsights.recommendations,
  ];

  // Add classification-based insights
  const enhancedInsights = [...baseAnalysis.insights];

  if (classificationInsights.dominantIntent === 'command') {
    enhancedInsights.push('주로 명령형 프롬프트를 사용');
  } else if (classificationInsights.dominantIntent === 'question') {
    enhancedInsights.push('주로 질문형 프롬프트를 사용');
  }

  if (classificationInsights.dominantCategory !== 'unknown') {
    enhancedInsights.push(
      `주요 작업 유형: ${getCategoryDisplayName(classificationInsights.dominantCategory)}`
    );
  }

  return {
    ...baseAnalysis,
    insights: enhancedInsights,
    recommendations: combinedRecommendations,
    classificationInsights,
    qualityScore: classificationInsights.averageQuality,
  };
}

/**
 * Get display name for task category
 */
function getCategoryDisplayName(category: TaskCategory): string {
  const names: Record<TaskCategory, string> = {
    'code-generation': '코드 생성',
    'code-review': '코드 리뷰',
    'bug-fix': '버그 수정',
    refactoring: '리팩토링',
    explanation: '설명',
    documentation: '문서화',
    testing: '테스트',
    architecture: '아키텍처',
    deployment: '배포',
    'data-analysis': '데이터 분석',
    general: '일반',
    unknown: '미분류',
  };
  return names[category];
}
