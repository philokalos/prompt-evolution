/**
 * Pattern Module
 * Central exports for all pattern types and utilities
 */

// Export registry utilities with unique names
export {
  getPatterns,
  getKeywords as getPatternKeywords,
  matchesPattern,
  findMatchingKeywords as findPatternKeywords,
  countMatches,
  type PatternType,
} from './registry.js';

// Export intent patterns
export {
  INTENT_PATTERNS,
  getIntentKeywords,
  matchesIntent,
  findIntentKeywords,
} from './intent-patterns.js';

// Export category patterns
export {
  CATEGORY_PATTERNS,
  getCategoryKeywords,
  matchesCategory,
  findCategoryKeywords,
} from './category-patterns.js';

// Export signal patterns (these are the ones signal-detector.ts uses)
export {
  POSITIVE_KEYWORDS,
  NEGATIVE_KEYWORDS,
  RETRY_PATTERNS,
  COMPLETION_PATTERNS,
  QUESTION_PATTERNS,
  COMMAND_PATTERNS,
  CONTEXT_PATTERNS,
  ALL_SIGNAL_PATTERNS as ALL_PATTERNS,
  getSignalKeywords,
  containsSignalPattern,
  findSignalKeywords,
  countSignalMatches,
  type SignalType,
} from './signal-patterns.js';

// Backward compatibility aliases for signal detection
export {
  containsSignalPattern as containsPattern,
  findSignalKeywords as findMatchingKeywords,
  countSignalMatches as countPatternMatches,
  getSignalKeywords as getKeywords,
} from './signal-patterns.js';
