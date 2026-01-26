/**
 * GOLDEN Consistency Validation
 * Ensures logical consistency between GOLDEN dimensions
 */

import type { GOLDENScore } from '../shared/types/index.js';

/**
 * Consistency rule definition
 */
export interface ConsistencyRule {
  id: string;
  name: string;
  description: string;
  condition: (scores: GOLDENScore) => boolean;
  penalty: number;
  affectedDimension: keyof Omit<GOLDENScore, 'total'>;
}

/**
 * Consistency rules for GOLDEN scoring
 * These detect logical inconsistencies that indicate scoring issues
 */
export const CONSISTENCY_RULES: ConsistencyRule[] = [
  {
    id: 'goal-without-output',
    name: 'Goal without Output',
    description: 'Clear goal stated but no expected output format',
    condition: (scores) => scores.goal > 0.7 && scores.output < 0.3,
    penalty: -0.10,
    affectedDimension: 'goal',
  },
  {
    id: 'limits-without-data',
    name: 'Limits without Data',
    description: 'Constraints specified but no context provided',
    condition: (scores) => scores.limits > 0.7 && scores.data < 0.3,
    penalty: -0.10,
    affectedDimension: 'limits',
  },
  {
    id: 'evaluation-without-goal',
    name: 'Evaluation without Goal',
    description: 'Success criteria defined but goal is unclear',
    condition: (scores) => scores.evaluation > 0.5 && scores.goal < 0.4,
    penalty: -0.15,
    affectedDimension: 'evaluation',
  },
  {
    id: 'next-without-evaluation',
    name: 'Next without Evaluation',
    description: 'Next steps mentioned but no success criteria',
    condition: (scores) => scores.next > 0.6 && scores.evaluation < 0.3,
    penalty: -0.10,
    affectedDimension: 'next',
  },
  {
    id: 'output-without-goal',
    name: 'Output without Goal',
    description: 'Output format specified but goal is unclear',
    condition: (scores) => scores.output > 0.6 && scores.goal < 0.3,
    penalty: -0.10,
    affectedDimension: 'output',
  },
  {
    id: 'data-without-goal',
    name: 'Data without Goal',
    description: 'Context provided but no clear task goal',
    condition: (scores) => scores.data > 0.7 && scores.goal < 0.3,
    penalty: -0.08,
    affectedDimension: 'data',
  },
];

/**
 * Apply consistency validation to GOLDEN scores
 * Returns adjusted scores and list of violated rules
 */
export function validateGOLDENConsistency(scores: GOLDENScore): {
  adjustedScores: GOLDENScore;
  violations: Array<{
    rule: ConsistencyRule;
    originalValue: number;
    adjustedValue: number;
  }>;
} {
  const adjustedScores = { ...scores };
  const violations: Array<{
    rule: ConsistencyRule;
    originalValue: number;
    adjustedValue: number;
  }> = [];

  for (const rule of CONSISTENCY_RULES) {
    if (rule.condition(scores)) {
      const dimension = rule.affectedDimension;
      const originalValue = adjustedScores[dimension];
      const adjustedValue = Math.max(0, originalValue + rule.penalty);

      adjustedScores[dimension] = adjustedValue;

      violations.push({
        rule,
        originalValue,
        adjustedValue,
      });
    }
  }

  // Recalculate total if any adjustments were made
  if (violations.length > 0) {
    adjustedScores.total = calculateGOLDENTotal(adjustedScores);
  }

  return { adjustedScores, violations };
}

/**
 * Calculate GOLDEN total score
 */
function calculateGOLDENTotal(scores: GOLDENScore): number {
  const dimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
  const sum = dimensions.reduce((acc, dim) => acc + scores[dim], 0);
  return Math.min(sum / dimensions.length, 1);
}

/**
 * Quality density patterns for length bias correction
 * These patterns indicate meaningful content regardless of length
 */
export const QUALITY_DENSITY_PATTERNS = {
  // Structural elements
  xmlTags: /<[a-z][^>]*>[\s\S]*<\/[a-z][^>]*>/gi,
  markdownHeaders: /^#+\s/gm,
  markdownLists: /^[-*]\s|^\d+\.\s/gm,
  codeBlocks: /```[\s\S]*?```/g,

  // GOLDEN-specific elements
  goalIndicators: /목표|목적|goal|objective|want|need|원하는|필요/gi,
  outputIndicators: /형식|포맷|format|JSON|table|list|출력/gi,
  limitsIndicators: /제약|constraint|only|without|except|하지\s*마|제외/gi,
  dataIndicators: /현재|상황|context|environment|using|사용|환경/gi,
  evaluationIndicators: /확인|검증|verify|success|테스트|test|성공/gi,
  nextIndicators: /다음|then|after|next|이후|단계|step/gi,
};

/**
 * Calculate quality density of text
 * Higher density = more meaningful content per word
 * Returns a score between 0 and 1
 */
export function calculateQualityDensity(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 0;

  let meaningfulElements = 0;

  // Count structural elements
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.xmlTags) || []).length * 3;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.markdownHeaders) || []).length * 2;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.markdownLists) || []).length;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.codeBlocks) || []).length * 4;

  // Count GOLDEN indicators
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.goalIndicators) || []).length;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.outputIndicators) || []).length;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.limitsIndicators) || []).length;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.dataIndicators) || []).length;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.evaluationIndicators) || []).length;
  meaningfulElements += (text.match(QUALITY_DENSITY_PATTERNS.nextIndicators) || []).length;

  // Calculate density (meaningful elements per 10 words, capped at 1)
  const density = Math.min(meaningfulElements / (wordCount / 10), 1);

  // Apply verbosity penalty for very long prompts with low density
  let verbosityPenalty = 0;
  if (wordCount > 200 && density < 0.3) {
    verbosityPenalty = -0.05;
  }
  if (wordCount > 400 && density < 0.4) {
    verbosityPenalty = -0.10;
  }

  // Final score: density bonus (max 0.1) + verbosity penalty
  const densityBonus = Math.min(density * 0.15, 0.10);
  return Math.max(0, densityBonus + verbosityPenalty);
}

/**
 * Determine if a task is primarily code-related
 */
export function isCodeRelatedTask(text: string, category?: string): boolean {
  if (category) {
    const codeCategories = ['code-generation', 'bug-fix', 'refactoring', 'testing', 'code-review'];
    if (codeCategories.includes(category)) {
      return true;
    }
  }

  // Check for code-related keywords
  const codePatterns = /코드|code|function|class|component|api|버그|bug|에러|error|테스트|test|리팩토링|refactor/i;
  return codePatterns.test(text);
}

/**
 * Get category-specific data dimension weights
 * Code tasks value code blocks more, non-code tasks value context explanation more
 */
export function getCategoryDataWeights(category: string): {
  codeBlockWeight: number;
  contextExplanationWeight: number;
  filePathWeight: number;
} {
  const codeCategories = ['code-generation', 'bug-fix', 'refactoring', 'testing', 'code-review'];

  if (codeCategories.includes(category)) {
    return {
      codeBlockWeight: 0.30,
      contextExplanationWeight: 0.20,
      filePathWeight: 0.25,
    };
  }

  // Non-code tasks (explanation, documentation, architecture, etc.)
  return {
    codeBlockWeight: 0.15,
    contextExplanationWeight: 0.30,
    filePathWeight: 0.15,
  };
}
