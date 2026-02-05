/**
 * Insights Generation Thresholds
 * Centralized thresholds for problem detection and insight generation
 *
 * Extracted from:
 * - insights.ts:315, 344, 364, 389, 432, 506, 523, 542
 * - scorer.ts:140, 147, 479, 483, 487, 491, 297, 300
 */

/**
 * Problem detection thresholds
 */
export const PROBLEM_DETECTION = {
  /** Effectiveness threshold for "low effectiveness" classification */
  LOW_EFFECTIVENESS: 0.4,
  /** Proportion threshold for flagging "many low effectiveness prompts" */
  LOW_EFFECTIVENESS_RATIO: 0.2,
  /** Proportion threshold for "too many unknown categories" */
  UNKNOWN_CATEGORY_RATIO: 0.3,
  /** Average clarity threshold for "low clarity" problem */
  LOW_CLARITY: 0.5,
  /** Average context threshold for "low context" problem */
  LOW_CONTEXT: 0.4,
} as const;

/**
 * Improvement opportunity thresholds
 */
export const IMPROVEMENT_DETECTION = {
  /** Command ratio threshold suggesting more question prompts */
  HIGH_COMMAND_RATIO: 0.8,
  /** Context score threshold for "needs more context" suggestion */
  LOW_CONTEXT_SCORE: 0.3,
  /** Proportion threshold for low context prompts */
  LOW_CONTEXT_RATIO: 0.5,
  /** Category dominance threshold for template suggestion */
  CATEGORY_DOMINANCE_RATIO: 0.3,
} as const;

/**
 * Strength detection thresholds
 */
export const STRENGTH_DETECTION = {
  /** Effectiveness threshold for "high effectiveness" */
  HIGH_EFFECTIVENESS: 0.8,
  /** Proportion threshold for "many high effectiveness prompts" */
  HIGH_EFFECTIVENESS_RATIO: 0.3,
  /** Clarity threshold for "good clarity" strength */
  GOOD_CLARITY: 0.7,
  /** Context threshold for "good context" strength */
  GOOD_CONTEXT: 0.6,
  /** Minimum categories for "diverse task types" strength */
  DIVERSE_CATEGORIES_MIN: 4,
} as const;

/**
 * Scorer thresholds
 */
export const SCORER_THRESHOLDS = {
  /** Sentiment score threshold for "positive" feedback insight */
  POSITIVE_SENTIMENT: 0.7,
  /** Sentiment score threshold for "negative" feedback insight */
  NEGATIVE_SENTIMENT: 0.3,
  /** Efficiency score threshold for "many retries" insight */
  LOW_EFFICIENCY: 0.5,
  /** Clarity threshold for "improve clarity" recommendation */
  CLARITY_RECOMMENDATION: 0.5,
  /** Context threshold for "add context" recommendation */
  CONTEXT_RECOMMENDATION: 0.4,
  /** Unknown ratio threshold for "specify task type" recommendation */
  UNKNOWN_TYPE_RATIO: 0.3,
  /** Command ratio threshold for "try questions" recommendation */
  COMMAND_DOMINANCE_RATIO: 0.8,
  /** Score threshold for identifying strongest area */
  STRENGTH_AREA_THRESHOLD: 0.6,
  /** Score threshold for identifying weakest area (issue) */
  WEAKNESS_AREA_THRESHOLD: 0.5,
} as const;

/**
 * Comparison thresholds
 */
export const COMPARISON_THRESHOLDS = {
  /** Score difference threshold for declaring a "tie" */
  TIE_DIFFERENCE: 0.05,
  /** Score difference threshold for significant comparison insight */
  SIGNIFICANT_DIFFERENCE: 0.2,
} as const;
