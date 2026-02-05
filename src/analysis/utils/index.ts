/**
 * Analysis Utilities Index
 * Central export for all analysis utility functions
 */

// Keyword matching utilities
export {
  escapeRegex,
  matchWithWordBoundary,
  matchSubstring,
  getPositionWeight,
  matchMultilingualKeywords,
  calculateMatchScore,
  type PositionWeightConfig,
  type MultilingualPatterns,
  type MatchResult,
} from './keyword-matcher.js';

// Signal scoring utilities
export {
  calculateConfidence,
  SIGNAL_TYPE_MAP,
  type ConfidenceConfig,
  type SignalPatternType,
  type SignalResultType,
} from './signal-scorer.js';
