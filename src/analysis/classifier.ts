/**
 * Prompt Classifier
 * Rule-based classification of user prompts by intent and task category
 *
 * v2 improvements:
 * - Context-aware scoring with position weighting
 * - Negation pattern detection
 * - Keyword co-occurrence bonuses
 * - Multi-label category support
 * - Disambiguation rules for keyword conflicts
 */

import {
  INTENT_PATTERNS,
  CATEGORY_PATTERNS,
  applyDisambiguationRules,
  applyCooccurrenceBonus,
  applyNegationPenalty,
} from './patterns/index.js';

// Import and re-export shared types
import type {
  PromptIntent,
  TaskCategory,
  ClassificationResult,
  PromptClassification,
  PromptFeatures,
  MultiLabelClassification,
  IntentScoreDetails,
} from '../shared/types/index.js';

export type {
  PromptIntent,
  TaskCategory,
  ClassificationResult,
  PromptClassification,
  PromptFeatures,
  MultiLabelClassification,
  IntentScoreDetails,
};

/**
 * Extract features from prompt text
 */
export function extractFeatures(text: string): PromptFeatures {
  const length = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasCodeBlock = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const hasUrl = /https?:\/\/[^\s]+/.test(text);
  const hasFilePath = /[/\\][\w.-]+\.[a-z]+/i.test(text) || /src\/|\.tsx?|\.jsx?/.test(text);
  const hasQuestionMark = text.includes('?');
  const hasExclamationMark = text.includes('!');

  // Detect language
  const koChars = (text.match(/[가-힣]/g) || []).length;
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  let languageHint: 'ko' | 'en' | 'mixed';
  if (koChars > enChars * 2) {
    languageHint = 'ko';
  } else if (enChars > koChars * 2) {
    languageHint = 'en';
  } else {
    languageHint = 'mixed';
  }

  // Estimate complexity
  let complexity: 'simple' | 'moderate' | 'complex';
  if (wordCount < 10 && !hasCodeBlock) {
    complexity = 'simple';
  } else if (wordCount < 50 || (hasCodeBlock && wordCount < 100)) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
  }

  return {
    length,
    wordCount,
    hasCodeBlock,
    hasUrl,
    hasFilePath,
    hasQuestionMark,
    hasExclamationMark,
    languageHint,
    complexity,
  };
}

/**
 * Calculate position weight for a keyword match
 * Keywords in the first 25% of text get 1.5x weight
 */
function getPositionWeight(text: string, keyword: string): number {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const position = lowerText.indexOf(lowerKeyword);

  if (position === -1) return 1.0;

  const textLength = text.length;
  const threshold = textLength * 0.25;

  // Keywords in first 25% get 1.5x weight
  return position < threshold ? 1.5 : 1.0;
}

/**
 * Classify prompt intent with context-aware scoring
 *
 * v2 improvements:
 * - Position weighting (front 25% gets x1.5)
 * - Negation pattern detection
 * - Better confidence calculation
 */
export function classifyIntent(text: string): {
  intent: PromptIntent;
  confidence: number;
  matchedKeywords: string[];
  scoreDetails?: Record<string, IntentScoreDetails>;
} {
  const lowerText = text.toLowerCase();
  const features = extractFeatures(text);
  const allMatched: string[] = [];

  // Score each intent with detailed breakdown
  const scoreDetails: Record<string, IntentScoreDetails> = {};
  const scores: Record<string, number> = {};

  for (const intent of Object.keys(INTENT_PATTERNS)) {
    scoreDetails[intent] = { base: 0, position: 0, negation: 0, cooccurrence: 0, total: 0 };
    scores[intent] = 0;
  }

  // Check patterns with language-aware matching and position weighting
  for (const intent of Object.keys(INTENT_PATTERNS)) {
    const patterns = INTENT_PATTERNS[intent];
    let baseScore = 0;
    let positionBonus = 0;

    // Korean keywords: substring matching
    for (const keyword of patterns.ko) {
      if (lowerText.includes(keyword.toLowerCase())) {
        const weight = getPositionWeight(text, keyword);
        baseScore += 1;
        positionBonus += weight - 1; // Only count the bonus portion
        allMatched.push(keyword);
      }
    }

    // English keywords: word boundary matching
    for (const keyword of patterns.en) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (regex.test(text)) {
        const weight = getPositionWeight(text, keyword);
        baseScore += 1;
        positionBonus += weight - 1;
        allMatched.push(keyword);
      }
    }

    scoreDetails[intent].base = baseScore;
    scoreDetails[intent].position = positionBonus;
    scores[intent] = baseScore + positionBonus;
  }

  // Apply negation penalties
  const adjustedScores = applyNegationPenalty(text, scores);

  // Record negation adjustments
  for (const intent of Object.keys(scores)) {
    const negationDelta = adjustedScores[intent] - scores[intent];
    if (negationDelta !== 0) {
      scoreDetails[intent].negation = negationDelta;
    }
    scores[intent] = adjustedScores[intent];
  }

  // Boost question score if has question mark
  if (features.hasQuestionMark) {
    scores.question += 2;
    scoreDetails.question.cooccurrence += 2;
  }

  // Calculate final totals
  for (const intent of Object.keys(scores)) {
    scoreDetails[intent].total = scores[intent];
  }

  // Find highest scoring intent
  let maxIntent: PromptIntent = 'unknown';
  let maxScore = 0;
  let secondMaxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      secondMaxScore = maxScore;
      maxScore = score;
      maxIntent = intent as PromptIntent;
    } else if (score > secondMaxScore) {
      secondMaxScore = score;
    }
  }

  // If command and question tie at max score, prefer command if no question mark
  if (
    scores.command === scores.question &&
    scores.command === maxScore &&
    maxScore > 0 &&
    !features.hasQuestionMark
  ) {
    maxIntent = 'command';
  }

  // Calculate confidence with improved formula
  // Base confidence from score ratio + gap between top two
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  let confidence: number;

  if (totalScore > 0) {
    const scoreRatio = maxScore / totalScore;
    const gapBonus = maxScore > 0 ? Math.min((maxScore - secondMaxScore) / maxScore * 0.2, 0.15) : 0;
    confidence = Math.min(scoreRatio + gapBonus + 0.1, 0.95);
  } else {
    confidence = 0.4; // Lower default confidence when no matches
  }

  // If no matches, try to infer from features
  if (maxScore === 0) {
    if (features.hasQuestionMark) {
      maxIntent = 'question';
      confidence = 0.6; // Moderate confidence for punctuation-based inference
    } else if (features.complexity === 'complex') {
      maxIntent = 'instruction';
      confidence = 0.45;
    } else {
      maxIntent = 'command';
      confidence = 0.4;
    }
  }

  return {
    intent: maxIntent,
    confidence,
    matchedKeywords: allMatched,
    scoreDetails,
  };
}

/**
 * Classify task category with disambiguation rules and multi-label support
 *
 * v2 improvements:
 * - Position-weighted scoring
 * - Disambiguation rules for keyword conflicts
 * - Co-occurrence bonuses
 * - Multi-label classification support
 */
export function classifyTaskCategory(text: string): {
  category: TaskCategory;
  confidence: number;
  multiLabel?: MultiLabelClassification;
} {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];

  // Initial scores with position weighting
  const scores: Record<string, number> = {};

  for (const category of Object.keys(CATEGORY_PATTERNS)) {
    scores[category] = 0;
    const patterns = CATEGORY_PATTERNS[category];

    // Korean keywords: substring matching with position weighting
    for (const keyword of patterns.ko) {
      if (lowerText.includes(keyword.toLowerCase())) {
        const weight = getPositionWeight(text, keyword);
        scores[category] += weight;
        matchedKeywords.push(keyword);
      }
    }

    // English keywords: word boundary matching with position weighting
    for (const keyword of patterns.en) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (regex.test(text)) {
        const weight = getPositionWeight(text, keyword);
        scores[category] += weight;
        matchedKeywords.push(keyword);
      }
    }
  }

  // Apply disambiguation rules for conflicting keywords
  const disambiguatedScores = applyDisambiguationRules(text, matchedKeywords, scores);

  // Apply co-occurrence bonuses
  const finalScores = applyCooccurrenceBonus(text, disambiguatedScores);

  // Sort categories by score to find top candidates
  const sortedCategories = Object.entries(finalScores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  // Determine primary category
  let maxCategory: TaskCategory = 'general';
  let maxScore = 0;
  let secondMaxScore = 0;

  if (sortedCategories.length > 0) {
    maxCategory = sortedCategories[0][0] as TaskCategory;
    maxScore = sortedCategories[0][1];

    if (sortedCategories.length > 1) {
      secondMaxScore = sortedCategories[1][1];
    }
  }

  // Calculate confidence with improved formula
  const totalScore = Object.values(finalScores).reduce((a, b) => a + b, 0);
  let confidence: number;

  if (totalScore > 0) {
    const scoreRatio = maxScore / totalScore;
    // Bonus for clear gap between top two categories
    const gapBonus = maxScore > 0 ? Math.min((maxScore - secondMaxScore) / maxScore * 0.15, 0.1) : 0;
    confidence = Math.min(scoreRatio + gapBonus + 0.05, 0.95);
  } else {
    confidence = 0.25; // Lower default confidence when no matches
  }

  if (maxScore === 0) {
    maxCategory = 'unknown';
    confidence = 0.2;
  }

  // Build multi-label classification
  const isMultiIntent = maxScore > 0 && secondMaxScore > 0 &&
    (maxScore - secondMaxScore) / maxScore < 0.15;

  const multiLabel: MultiLabelClassification = {
    primary: { category: maxCategory, confidence },
    secondary: sortedCategories
      .slice(1, 3) // Top 2 secondary categories
      .map(([cat, score]) => ({
        category: cat as TaskCategory,
        confidence: totalScore > 0 ? Math.min(score / totalScore + 0.05, 0.9) : 0.2,
      })),
    isMultiIntent,
  };

  return {
    category: maxCategory,
    confidence,
    multiLabel,
  };
}

/**
 * Full classification of a prompt
 */
export function classifyPrompt(text: string): ClassificationResult {
  const features = extractFeatures(text);
  const intentResult = classifyIntent(text);
  const categoryResult = classifyTaskCategory(text);

  return {
    intent: intentResult.intent,
    intentConfidence: intentResult.confidence,
    taskCategory: categoryResult.category,
    categoryConfidence: categoryResult.confidence,
    matchedKeywords: intentResult.matchedKeywords,
    features,
    // v2: Include multi-label classification and score details
    multiLabel: categoryResult.multiLabel,
    intentScoreDetails: intentResult.scoreDetails,
  };
}

/**
 * Get human-readable intent label
 */
export function getIntentLabel(intent: PromptIntent): string {
  const labels: Record<PromptIntent, string> = {
    command: '⚡ 명령',
    question: '❓ 질문',
    instruction: '📝 지시',
    feedback: '💬 피드백',
    context: '📋 컨텍스트',
    clarification: '🔍 명확화 요청',
    unknown: '❔ 미분류',
  };
  return labels[intent];
}

/**
 * Get human-readable category label
 */
export function getCategoryLabel(category: TaskCategory): string {
  const labels: Record<TaskCategory, string> = {
    'code-generation': '🔨 코드 생성',
    'code-review': '👀 코드 리뷰',
    'bug-fix': '🐛 버그 수정',
    refactoring: '♻️ 리팩토링',
    explanation: '💡 설명',
    documentation: '📖 문서화',
    testing: '🧪 테스트',
    architecture: '🏗️ 아키텍처',
    deployment: '🚀 배포',
    'data-analysis': '📊 데이터 분석',
    general: '📌 일반',
    unknown: '❔ 미분류',
  };
  return labels[category];
}

/**
 * Batch classify multiple prompts
 */
export function classifyPrompts(texts: string[]): ClassificationResult[] {
  return texts.map(classifyPrompt);
}

/**
 * Get classification statistics
 */
export interface ClassificationStats {
  totalPrompts: number;
  intentDistribution: Record<PromptIntent, number>;
  categoryDistribution: Record<TaskCategory, number>;
  avgIntentConfidence: number;
  avgCategoryConfidence: number;
}

export function getClassificationStats(
  results: ClassificationResult[]
): ClassificationStats {
  const stats: ClassificationStats = {
    totalPrompts: results.length,
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
    avgIntentConfidence: 0,
    avgCategoryConfidence: 0,
  };

  if (results.length === 0) return stats;

  let totalIntentConf = 0;
  let totalCategoryConf = 0;

  for (const result of results) {
    stats.intentDistribution[result.intent]++;
    stats.categoryDistribution[result.taskCategory]++;
    totalIntentConf += result.intentConfidence;
    totalCategoryConf += result.categoryConfidence;
  }

  stats.avgIntentConfidence = totalIntentConf / results.length;
  stats.avgCategoryConfidence = totalCategoryConf / results.length;

  return stats;
}
