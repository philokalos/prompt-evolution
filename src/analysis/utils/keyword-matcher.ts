/**
 * Keyword Matching Utilities
 * Centralized utilities for keyword matching with regex escaping and position weighting
 *
 * Extracted from:
 * - classifier.ts:93-105, 141-159, 275-292
 */

import { POSITION_WEIGHTING } from '../../shared/config/index.js';

/**
 * Escape special regex characters in a string
 * Used for safe word boundary matching
 */
export function escapeRegex(keyword: string): string {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match a keyword with word boundaries (for English keywords)
 * Returns true if the keyword exists as a whole word in the text
 */
export function matchWithWordBoundary(text: string, keyword: string): boolean {
  const escapedKeyword = escapeRegex(keyword);
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
  return regex.test(text);
}

/**
 * Match a keyword as substring (for Korean keywords)
 * Returns true if the keyword exists anywhere in the text
 */
export function matchSubstring(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Configuration for position weight calculation
 */
export interface PositionWeightConfig {
  /** Threshold for "early" position (fraction of text length) */
  threshold?: number;
  /** Weight multiplier for keywords in early position */
  earlyMultiplier?: number;
  /** Default weight for keywords not in early position */
  defaultWeight?: number;
}

/**
 * Calculate position weight for a keyword match
 * Keywords appearing earlier in text are weighted more heavily
 */
export function getPositionWeight(
  text: string,
  keyword: string,
  config: PositionWeightConfig = {}
): number {
  const {
    threshold = POSITION_WEIGHTING.THRESHOLD,
    earlyMultiplier = POSITION_WEIGHTING.EARLY_MULTIPLIER,
    defaultWeight = POSITION_WEIGHTING.DEFAULT_WEIGHT,
  } = config;

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const position = lowerText.indexOf(lowerKeyword);

  if (position === -1) return defaultWeight;

  const textLength = text.length;
  const positionThreshold = textLength * threshold;

  return position < positionThreshold ? earlyMultiplier : defaultWeight;
}

/**
 * Match multilingual keywords against text
 * Uses word boundary for English, substring for Korean
 */
export interface MultilingualPatterns {
  ko: readonly string[];
  en: readonly string[];
}

export interface MatchResult {
  keyword: string;
  weight: number;
}

/**
 * Match keywords from a multilingual pattern set
 * Returns matched keywords with their position weights
 */
export function matchMultilingualKeywords(
  text: string,
  patterns: MultilingualPatterns,
  config: PositionWeightConfig = {}
): MatchResult[] {
  const results: MatchResult[] = [];

  // Korean keywords: substring matching
  for (const keyword of patterns.ko) {
    if (matchSubstring(text, keyword)) {
      results.push({
        keyword,
        weight: getPositionWeight(text, keyword, config),
      });
    }
  }

  // English keywords: word boundary matching
  for (const keyword of patterns.en) {
    if (matchWithWordBoundary(text, keyword)) {
      results.push({
        keyword,
        weight: getPositionWeight(text, keyword, config),
      });
    }
  }

  return results;
}

/**
 * Calculate total score from match results
 */
export function calculateMatchScore(results: MatchResult[]): {
  baseScore: number;
  positionBonus: number;
  totalScore: number;
} {
  let baseScore = 0;
  let positionBonus = 0;

  for (const result of results) {
    baseScore += 1;
    positionBonus += result.weight - 1; // Only count the bonus portion
  }

  return {
    baseScore,
    positionBonus,
    totalScore: baseScore + positionBonus,
  };
}
