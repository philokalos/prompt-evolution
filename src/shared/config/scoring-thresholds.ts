/**
 * Scoring Configuration
 * Centralized thresholds and multipliers for confidence and effectiveness scoring
 *
 * Extracted from:
 * - signal-detector.ts:186-194
 * - scorer.ts:31-36, 89-94
 */

/**
 * Confidence calculation parameters for signal detection
 */
export const CONFIDENCE = {
  /** Multiplier applied per matched keyword */
  BASE_MULTIPLIER: 0.3,
  /** Maximum confidence cap */
  MAX: 0.9,
  /** Content length considered "short" */
  SHORT_CONTENT_THRESHOLD: 100,
  /** Content length considered "medium" */
  MEDIUM_CONTENT_THRESHOLD: 500,
  /** Confidence factor for short content (more confident with fewer words) */
  SHORT_CONTENT_FACTOR: 1.1,
  /** Confidence factor for long content (less confident) */
  LONG_CONTENT_FACTOR: 0.9,
} as const;

/**
 * Grade boundaries for effectiveness scores
 * Maps score ranges to letter grades (A-F)
 */
export const GRADE_THRESHOLDS = {
  A: 0.9,
  B: 0.75,
  C: 0.6,
  D: 0.4,
  F: 0,
} as const;

/**
 * Effectiveness weights for calculating overall score
 */
export const EFFECTIVENESS_WEIGHTS = {
  sentiment: 0.35,
  completion: 0.25,
  efficiency: 0.25,
  engagement: 0.15,
} as const;

/**
 * Prompt quality score weights
 */
export const QUALITY_WEIGHTS = {
  clarity: 0.4,
  structure: 0.35,
  context: 0.25,
} as const;

/**
 * Signal type to detection pattern mapping
 */
export const SIGNAL_TYPES = [
  'positive',
  'negative',
  'retry',
  'completion',
  'question',
  'command',
  'context',
] as const;

export type SignalPatternType = (typeof SIGNAL_TYPES)[number];
