/**
 * Disambiguation Rules
 * Resolves keyword conflicts between categories
 */

import type { TaskCategory } from '../../shared/types/index.js';

/**
 * Disambiguation rule definition
 */
export interface DisambiguationRule {
  keyword: string;
  conflictingCategories: TaskCategory[];
  resolutionPatterns: Array<{
    pattern: RegExp;
    resolvedCategory: TaskCategory;
    bonus: number;
  }>;
}

/**
 * Disambiguation rules for common keyword conflicts
 */
export const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  {
    keyword: 'fix',
    conflictingCategories: ['bug-fix', 'code-generation'],
    resolutionPatterns: [
      {
        pattern: /error|bug|exception|crash|fail|broken|issue|problem|TypeError|ReferenceError|에러|오류|버그/i,
        resolvedCategory: 'bug-fix',
        bonus: 0.4,
      },
      {
        pattern: /add|new|create|feature|implement|만들어|생성|추가/i,
        resolvedCategory: 'code-generation',
        bonus: 0.3,
      },
    ],
  },
  {
    keyword: 'test',
    conflictingCategories: ['testing', 'code-review'],
    resolutionPatterns: [
      {
        pattern: /unit|spec|vitest|jest|mocha|coverage|테스트\s*코드|테스트\s*작성|e2e|integration/i,
        resolvedCategory: 'testing',
        bonus: 0.5,
      },
      {
        pattern: /check|review|verify|validate|확인|검토|검증/i,
        resolvedCategory: 'code-review',
        bonus: 0.3,
      },
    ],
  },
  {
    keyword: 'create',
    conflictingCategories: ['code-generation', 'documentation'],
    resolutionPatterns: [
      {
        pattern: /doc|readme|guide|comment|문서|주석|설명서|가이드/i,
        resolvedCategory: 'documentation',
        bonus: 0.3,
      },
      {
        pattern: /function|class|component|module|api|service|함수|클래스|컴포넌트/i,
        resolvedCategory: 'code-generation',
        bonus: 0.4,
      },
    ],
  },
  {
    keyword: '수정',
    conflictingCategories: ['bug-fix', 'refactoring', 'code-generation'],
    resolutionPatterns: [
      {
        pattern: /에러|오류|버그|문제|안됨|안돼/i,
        resolvedCategory: 'bug-fix',
        bonus: 0.4,
      },
      {
        pattern: /리팩토링|개선|정리|구조|clean/i,
        resolvedCategory: 'refactoring',
        bonus: 0.35,
      },
      {
        pattern: /추가|새로|기능/i,
        resolvedCategory: 'code-generation',
        bonus: 0.3,
      },
    ],
  },
  {
    keyword: 'improve',
    conflictingCategories: ['refactoring', 'bug-fix'],
    resolutionPatterns: [
      {
        pattern: /performance|speed|optimize|성능|최적화|빠르게/i,
        resolvedCategory: 'refactoring',
        bonus: 0.4,
      },
      {
        pattern: /error|bug|fix|에러|버그/i,
        resolvedCategory: 'bug-fix',
        bonus: 0.35,
      },
    ],
  },
  {
    keyword: '설명',
    conflictingCategories: ['explanation', 'documentation'],
    resolutionPatterns: [
      {
        pattern: /뭐야|왜|어떻게|이해|의미|작동|원리|what|how|why/i,
        resolvedCategory: 'explanation',
        bonus: 0.4,
      },
      {
        pattern: /문서|readme|주석|comment|doc/i,
        resolvedCategory: 'documentation',
        bonus: 0.35,
      },
    ],
  },
];

/**
 * Apply disambiguation rules to resolve category conflicts
 * @param text The prompt text
 * @param matchedKeywords Keywords that were matched
 * @param categoryScores Current category scores
 * @returns Adjusted category scores
 */
export function applyDisambiguationRules(
  text: string,
  matchedKeywords: string[],
  categoryScores: Record<string, number>
): Record<string, number> {
  const adjustedScores = { ...categoryScores };
  const lowerText = text.toLowerCase();
  const lowerKeywords = matchedKeywords.map(k => k.toLowerCase());

  for (const rule of DISAMBIGUATION_RULES) {
    // Check if this rule's keyword was matched
    if (!lowerKeywords.includes(rule.keyword.toLowerCase())) {
      continue;
    }

    // Check if there's an actual conflict (multiple categories have scores)
    const conflictingScores = rule.conflictingCategories.filter(
      cat => (categoryScores[cat] || 0) > 0
    );

    if (conflictingScores.length < 2) {
      continue;
    }

    // Apply resolution patterns
    for (const resolution of rule.resolutionPatterns) {
      if (resolution.pattern.test(lowerText)) {
        adjustedScores[resolution.resolvedCategory] =
          (adjustedScores[resolution.resolvedCategory] || 0) + resolution.bonus;
        break; // Only apply first matching resolution
      }
    }
  }

  return adjustedScores;
}

/**
 * Co-occurrence patterns for boosting confidence
 * When these keywords appear together, boost the category score
 */
export const COOCCURRENCE_PATTERNS: Array<{
  keywords: string[];
  category: TaskCategory;
  bonus: number;
}> = [
  // Bug fix combinations
  { keywords: ['fix', 'bug'], category: 'bug-fix', bonus: 0.3 },
  { keywords: ['fix', 'error'], category: 'bug-fix', bonus: 0.3 },
  { keywords: ['수정', '버그'], category: 'bug-fix', bonus: 0.3 },
  { keywords: ['수정', '에러'], category: 'bug-fix', bonus: 0.3 },
  { keywords: ['고쳐', '오류'], category: 'bug-fix', bonus: 0.3 },

  // Testing combinations
  { keywords: ['write', 'test'], category: 'testing', bonus: 0.3 },
  { keywords: ['add', 'test'], category: 'testing', bonus: 0.25 },
  { keywords: ['테스트', '작성'], category: 'testing', bonus: 0.3 },
  { keywords: ['unit', 'test'], category: 'testing', bonus: 0.35 },

  // Code generation combinations
  { keywords: ['create', 'component'], category: 'code-generation', bonus: 0.3 },
  { keywords: ['implement', 'feature'], category: 'code-generation', bonus: 0.3 },
  { keywords: ['만들어', '기능'], category: 'code-generation', bonus: 0.3 },
  { keywords: ['구현', '컴포넌트'], category: 'code-generation', bonus: 0.3 },

  // Refactoring combinations
  { keywords: ['refactor', 'code'], category: 'refactoring', bonus: 0.25 },
  { keywords: ['리팩토링', '코드'], category: 'refactoring', bonus: 0.25 },
  { keywords: ['clean', 'up'], category: 'refactoring', bonus: 0.2 },
  { keywords: ['정리', '코드'], category: 'refactoring', bonus: 0.25 },

  // Documentation combinations
  { keywords: ['write', 'documentation'], category: 'documentation', bonus: 0.3 },
  { keywords: ['add', 'comment'], category: 'documentation', bonus: 0.25 },
  { keywords: ['문서', '작성'], category: 'documentation', bonus: 0.3 },

  // Architecture combinations
  { keywords: ['design', 'system'], category: 'architecture', bonus: 0.3 },
  { keywords: ['설계', '시스템'], category: 'architecture', bonus: 0.3 },
  { keywords: ['architecture', 'pattern'], category: 'architecture', bonus: 0.35 },
];

/**
 * Apply co-occurrence bonuses to category scores
 */
export function applyCooccurrenceBonus(
  text: string,
  categoryScores: Record<string, number>
): Record<string, number> {
  const adjustedScores = { ...categoryScores };
  const lowerText = text.toLowerCase();

  for (const pattern of COOCCURRENCE_PATTERNS) {
    const allKeywordsMatch = pattern.keywords.every(keyword => {
      // Korean: substring matching
      if (/[가-힣]/.test(keyword)) {
        return lowerText.includes(keyword.toLowerCase());
      }
      // English: word boundary matching
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    });

    if (allKeywordsMatch) {
      adjustedScores[pattern.category] =
        (adjustedScores[pattern.category] || 0) + pattern.bonus;
    }
  }

  return adjustedScores;
}

/**
 * Negation patterns that reduce confidence for certain categories
 */
export const NEGATION_PATTERNS: Array<{
  pattern: RegExp;
  affectedIntents: string[];
  penalty: number;
}> = [
  {
    pattern: /don't|doesn't|didn't|won't|하지\s*마|하지\s*마세요|않|말고|no\s+need/i,
    affectedIntents: ['command', 'instruction'],
    penalty: -0.3,
  },
  {
    pattern: /not\s+asking|질문\s*아니|묻는\s*게\s*아니/i,
    affectedIntents: ['question'],
    penalty: -0.4,
  },
  {
    pattern: /don't\s+create|don't\s+make|만들지\s*마|생성하지\s*마/i,
    affectedIntents: ['command'],
    penalty: -0.5,
  },
];

/**
 * Apply negation penalties to intent scores
 */
export function applyNegationPenalty(
  text: string,
  intentScores: Record<string, number>
): Record<string, number> {
  const adjustedScores = { ...intentScores };

  for (const negation of NEGATION_PATTERNS) {
    if (negation.pattern.test(text)) {
      for (const intent of negation.affectedIntents) {
        if (adjustedScores[intent] !== undefined) {
          adjustedScores[intent] = Math.max(0, adjustedScores[intent] + negation.penalty);
        }
      }
    }
  }

  return adjustedScores;
}
