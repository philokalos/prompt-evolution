/**
 * Prompt Classifier
 * Rule-based classification of user prompts by intent and task category
 */

import {
  INTENT_PATTERNS,
  CATEGORY_PATTERNS,
  getIntentKeywords,
  getCategoryKeywords,
} from './patterns/index.js';

// Import and re-export shared types
import type {
  PromptIntent,
  TaskCategory,
  ClassificationResult,
  PromptClassification,
  PromptFeatures,
} from '../shared/types/index.js';

export type {
  PromptIntent,
  TaskCategory,
  ClassificationResult,
  PromptClassification,
  PromptFeatures,
};

/**
 * Extract features from prompt text
 */
export function extractFeatures(text: string): PromptFeatures {
  const length = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasCodeBlock = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const hasUrl = /https?:\/\/[^\s]+/.test(text);
  const hasFilePath = /[\/\\][\w.-]+\.[a-z]+/i.test(text) || /src\/|\.tsx?|\.jsx?/.test(text);
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
 * Classify prompt intent
 */
export function classifyIntent(text: string): {
  intent: PromptIntent;
  confidence: number;
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();
  const features = extractFeatures(text);
  const allMatched: string[] = [];

  // Score each intent (must match all keys in INTENT_PATTERNS)
  const scores: Record<string, number> = {
    command: 0,
    question: 0,
    instruction: 0,
    feedback: 0,
    context: 0,
    clarification: 0,
  };

  // Check patterns with language-aware matching
  // Korean: substring matching (agglutinative language, no word boundaries)
  // English: word boundary matching (avoid partial matches like "then" in "authentication")
  for (const intent of Object.keys(INTENT_PATTERNS)) {
    const patterns = INTENT_PATTERNS[intent];
    // Korean keywords: substring matching
    for (const keyword of patterns.ko) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[intent]++;
        allMatched.push(keyword);
      }
    }
    // English keywords: word boundary matching
    for (const keyword of patterns.en) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (regex.test(text)) {
        scores[intent]++;
        allMatched.push(keyword);
      }
    }
  }

  // Boost question score if has question mark
  if (features.hasQuestionMark) {
    scores.question += 2;
  }

  // Find highest scoring intent
  let maxIntent: PromptIntent = 'unknown';
  let maxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent as PromptIntent;
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

  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence =
    totalScore > 0 ? Math.min(maxScore / totalScore + 0.2, 1.0) : 0.5;

  // If no matches, try to infer from features
  if (maxScore === 0) {
    if (features.hasQuestionMark) {
      maxIntent = 'question';
    } else if (features.complexity === 'complex') {
      maxIntent = 'instruction';
    } else {
      maxIntent = 'command';
    }
  }

  return {
    intent: maxIntent,
    confidence,
    matchedKeywords: allMatched,
  };
}

/**
 * Classify task category
 */
export function classifyTaskCategory(text: string): {
  category: TaskCategory;
  confidence: number;
} {
  const lowerText = text.toLowerCase();

  const scores: Record<string, number> = {};

  for (const category of Object.keys(CATEGORY_PATTERNS)) {
    scores[category] = 0;
    const patterns = CATEGORY_PATTERNS[category];
    // Korean keywords: substring matching
    for (const keyword of patterns.ko) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category]++;
      }
    }
    // English keywords: word boundary matching
    for (const keyword of patterns.en) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (regex.test(text)) {
        scores[category]++;
      }
    }
  }

  let maxCategory: TaskCategory = 'general';
  let maxScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category as TaskCategory;
    }
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence =
    totalScore > 0 ? Math.min(maxScore / totalScore + 0.15, 1.0) : 0.3;

  if (maxScore === 0) {
    maxCategory = 'unknown';
  }

  return {
    category: maxCategory,
    confidence,
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
