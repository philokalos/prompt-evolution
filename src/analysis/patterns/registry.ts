/**
 * Pattern Registry
 * Unified interface for all pattern types
 */

import { INTENT_PATTERNS, getIntentKeywords, matchesIntent, findIntentKeywords } from './intent-patterns.js';
import { CATEGORY_PATTERNS, getCategoryKeywords, matchesCategory, findCategoryKeywords } from './category-patterns.js';
import {
  ALL_SIGNAL_PATTERNS,
  getSignalKeywords,
  containsSignalPattern,
  findSignalKeywords,
  countSignalMatches,
  type SignalType,
} from './signal-patterns.js';

/**
 * Pattern type discriminator
 */
export type PatternType = 'intent' | 'category' | 'signal';

/**
 * Get patterns by type
 */
export function getPatterns(type: PatternType): Record<string, any> {
  switch (type) {
    case 'intent':
      return INTENT_PATTERNS;
    case 'category':
      return CATEGORY_PATTERNS;
    case 'signal':
      return ALL_SIGNAL_PATTERNS;
  }
}

/**
 * Get all keywords for a specific pattern
 */
export function getKeywords(type: PatternType, key: string): string[] {
  switch (type) {
    case 'intent':
      return getIntentKeywords(key);
    case 'category':
      return getCategoryKeywords(key);
    case 'signal':
      return getSignalKeywords(key as keyof typeof ALL_SIGNAL_PATTERNS);
    default:
      return [];
  }
}

/**
 * Check if text matches a pattern
 */
export function matchesPattern(text: string, type: PatternType, key: string): boolean {
  switch (type) {
    case 'intent':
      return matchesIntent(text, key);
    case 'category':
      return matchesCategory(text, key);
    case 'signal':
      return containsSignalPattern(text, key as keyof typeof ALL_SIGNAL_PATTERNS);
    default:
      return false;
  }
}

/**
 * Find matching keywords in text
 */
export function findMatchingKeywords(text: string, type: PatternType, key: string): string[] {
  switch (type) {
    case 'intent':
      return findIntentKeywords(text, key);
    case 'category':
      return findCategoryKeywords(text, key);
    case 'signal':
      return findSignalKeywords(text, key as keyof typeof ALL_SIGNAL_PATTERNS);
    default:
      return [];
  }
}

/**
 * Count pattern matches
 */
export function countMatches(text: string, type: PatternType, key: string): number {
  if (type === 'signal') {
    return countSignalMatches(text, key as keyof typeof ALL_SIGNAL_PATTERNS);
  }
  return findMatchingKeywords(text, type, key).length;
}

// Re-export specific pattern functions for convenience
export {
  getIntentKeywords,
  matchesIntent,
  findIntentKeywords,
  getCategoryKeywords,
  matchesCategory,
  findCategoryKeywords,
  getSignalKeywords,
  containsSignalPattern as containsPattern,
  findSignalKeywords,
  countSignalMatches as countPatternMatches,
};

// Re-export pattern constants
export { INTENT_PATTERNS } from './intent-patterns.js';
export { CATEGORY_PATTERNS } from './category-patterns.js';
export {
  POSITIVE_KEYWORDS,
  NEGATIVE_KEYWORDS,
  RETRY_PATTERNS,
  COMPLETION_PATTERNS,
  QUESTION_PATTERNS,
  COMMAND_PATTERNS,
  CONTEXT_PATTERNS,
  ALL_SIGNAL_PATTERNS as ALL_PATTERNS,
  type SignalType,
} from './signal-patterns.js';
