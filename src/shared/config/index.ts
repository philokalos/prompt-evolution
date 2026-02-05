/**
 * Configuration Index
 * Central export for all configuration constants
 */

// Scoring and confidence thresholds
export {
  CONFIDENCE,
  GRADE_THRESHOLDS,
  EFFECTIVENESS_WEIGHTS,
  QUALITY_WEIGHTS,
  SIGNAL_TYPES,
  type SignalPatternType,
} from './scoring-thresholds.js';

// Classification and analysis config
export {
  POSITION_WEIGHTING,
  CLASSIFICATION_CONFIDENCE,
  CATEGORY_CONFIDENCE,
  FEATURE_THRESHOLDS,
} from './analysis-config.js';

// Insights generation thresholds
export {
  PROBLEM_DETECTION,
  IMPROVEMENT_DETECTION,
  STRENGTH_DETECTION,
  SCORER_THRESHOLDS,
  COMPARISON_THRESHOLDS,
} from './insights-thresholds.js';
