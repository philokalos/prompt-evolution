/**
 * Analysis Configuration
 * Centralized settings for classification and pattern matching
 *
 * Extracted from:
 * - classifier.ts:93-104, 180-183, 225, 340
 */

/**
 * Position weighting configuration for keyword matching
 * Keywords appearing earlier in text are weighted more heavily
 */
export const POSITION_WEIGHTING = {
  /** Threshold for "early" position (fraction of text length) */
  THRESHOLD: 0.25,
  /** Weight multiplier for keywords in early position */
  EARLY_MULTIPLIER: 1.5,
  /** Default weight for keywords not in early position */
  DEFAULT_WEIGHT: 1.0,
} as const;

/**
 * Confidence calculation parameters for classification
 */
export const CLASSIFICATION_CONFIDENCE = {
  /** Bonus score added for question mark presence */
  QUESTION_MARK_BONUS: 2,
  /** Default confidence when no pattern matches */
  NO_MATCH_DEFAULT: 0.4,
  /** Confidence for question mark only inference */
  QUESTION_MARK_INFERENCE: 0.6,
  /** Confidence for complexity-based inference */
  COMPLEXITY_INFERENCE: 0.45,
  /** Maximum confidence cap */
  MAX_CONFIDENCE: 0.95,
  /** Minimum gap ratio for multi-intent detection */
  MULTI_INTENT_GAP_RATIO: 0.15,
} as const;

/**
 * Task category confidence parameters
 */
export const CATEGORY_CONFIDENCE = {
  /** Default confidence when no category matches */
  NO_MATCH_DEFAULT: 0.25,
  /** Confidence for unknown category */
  UNKNOWN_DEFAULT: 0.2,
  /** Maximum confidence cap */
  MAX_CONFIDENCE: 0.95,
} as const;

/**
 * Prompt feature thresholds
 */
export const FEATURE_THRESHOLDS = {
  /** Word count for "simple" complexity */
  SIMPLE_WORD_COUNT: 10,
  /** Word count for "moderate" complexity (without code) */
  MODERATE_WORD_COUNT: 50,
  /** Word count for "moderate" complexity (with code) */
  MODERATE_CODE_WORD_COUNT: 100,
  /** Minimum word count for good structure */
  MIN_GOOD_WORD_COUNT: 10,
  /** Maximum word count for good structure */
  MAX_GOOD_WORD_COUNT: 100,
  /** Minimum word count for context bonus */
  MIN_CONTEXT_WORD_COUNT: 20,
} as const;
