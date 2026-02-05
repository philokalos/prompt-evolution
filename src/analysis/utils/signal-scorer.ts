/**
 * Signal Scoring Utilities
 * Centralized utilities for signal confidence calculation
 *
 * Extracted from:
 * - signal-detector.ts:186-194
 */

import { CONFIDENCE } from '../../shared/config/index.js';

/**
 * Configuration for confidence calculation
 */
export interface ConfidenceConfig {
  /** Multiplier applied per matched keyword */
  baseMultiplier?: number;
  /** Maximum confidence cap */
  maxConfidence?: number;
  /** Content length considered "short" */
  shortContentThreshold?: number;
  /** Content length considered "medium" */
  mediumContentThreshold?: number;
  /** Confidence factor for short content */
  shortContentFactor?: number;
  /** Confidence factor for long content */
  longContentFactor?: number;
}

/**
 * Calculate confidence based on keyword matches and content length
 * Higher keyword count and shorter content increase confidence
 */
export function calculateConfidence(
  keywordCount: number,
  contentLength: number,
  config: ConfidenceConfig = {}
): number {
  const {
    baseMultiplier = CONFIDENCE.BASE_MULTIPLIER,
    maxConfidence = CONFIDENCE.MAX,
    shortContentThreshold = CONFIDENCE.SHORT_CONTENT_THRESHOLD,
    mediumContentThreshold = CONFIDENCE.MEDIUM_CONTENT_THRESHOLD,
    shortContentFactor = CONFIDENCE.SHORT_CONTENT_FACTOR,
    longContentFactor = CONFIDENCE.LONG_CONTENT_FACTOR,
  } = config;

  // Base confidence from keyword count
  const baseConfidence = Math.min(keywordCount * baseMultiplier, maxConfidence);

  // Adjust for content length (shorter content with keywords = higher confidence)
  const lengthFactor =
    contentLength < shortContentThreshold
      ? shortContentFactor
      : contentLength < mediumContentThreshold
        ? 1.0
        : longContentFactor;

  return Math.min(baseConfidence * lengthFactor, 1.0);
}

/**
 * Signal type mapping for creating DetectedSignal objects
 */
export const SIGNAL_TYPE_MAP = {
  positive: 'positive_feedback',
  negative: 'negative_feedback',
  retry: 'retry_attempt',
  completion: 'task_completion',
  question: 'question',
  command: 'command',
  context: 'context_providing',
} as const;

export type SignalPatternType = keyof typeof SIGNAL_TYPE_MAP;
export type SignalResultType = (typeof SIGNAL_TYPE_MAP)[SignalPatternType];
