/**
 * Shared Constants
 * Central location for all shared configuration values
 */

/**
 * Time period options
 */
export const TIME_PERIODS = ['7d', '30d', '90d', 'all'] as const;
export type TimePeriod = typeof TIME_PERIODS[number];

/**
 * Task categories (matches TaskCategory type)
 */
export const TASK_CATEGORIES = [
  'code-generation',
  'code-review',
  'bug-fix',
  'refactoring',
  'explanation',
  'documentation',
  'testing',
  'architecture',
  'deployment',
  'data-analysis',
  'general',
  'unknown',
] as const;

/**
 * Prompt intents (matches PromptIntent type)
 */
export const PROMPT_INTENTS = [
  'command',
  'question',
  'instruction',
  'feedback',
  'context',
  'clarification',
  'unknown',
] as const;

/**
 * Confidence thresholds for classification
 */
export const CONFIDENCE_THRESHOLDS = {
  INTENT_THRESHOLD: 0.7,
  CATEGORY_THRESHOLD: 0.6,
  AI_THRESHOLD: 0.7,
} as const;

/**
 * Effectiveness scoring weights
 */
export const EFFECTIVENESS_WEIGHTS = {
  sentiment: 0.35,
  clarity: 0.25,
  completion: 0.20,
  engagement: 0.15,
  efficiency: 0.05,
} as const;

/**
 * Grade boundaries for GOLDEN scores
 */
export const GRADE_BOUNDARIES = {
  A: 0.9,
  B: 0.75,
  C: 0.6,
  D: 0.45,
  F: 0,
} as const;

/**
 * Query stale times (in milliseconds)
 */
export const QUERY_STALE_TIMES = {
  STATS: 5 * 60 * 1000, // 5 minutes
  INSIGHTS: 5 * 60 * 1000, // 5 minutes
  SYNC_STATUS: 30 * 1000, // 30 seconds
  PROJECTS: 5 * 60 * 1000, // 5 minutes
  TRENDS: 5 * 60 * 1000, // 5 minutes
} as const;
