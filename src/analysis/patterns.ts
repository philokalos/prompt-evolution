/**
 * Quality Signal Patterns (Legacy)
 * Re-exports from new pattern registry for backward compatibility
 */

export {
  POSITIVE_KEYWORDS,
  NEGATIVE_KEYWORDS,
  RETRY_PATTERNS,
  COMPLETION_PATTERNS,
  QUESTION_PATTERNS,
  COMMAND_PATTERNS,
  CONTEXT_PATTERNS,
  ALL_PATTERNS,
  getKeywords,
  containsPattern,
  findMatchingKeywords,
  countPatternMatches,
  type SignalType,
} from './patterns/index.js';
