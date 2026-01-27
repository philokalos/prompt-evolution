/**
 * 증거 기반 신뢰도 계산 (v3)
 */

import type { SessionContext } from '../session-context.js';
import type { ConfidenceFactors, GuidelineEvaluation } from './types.js';

/**
 * Calculate calibrated confidence based on actual evidence
 * Replaces the old unconditional high confidence (0.90-0.98)
 */
export function calculateCalibratedConfidence(factors: ConfidenceFactors): number {
  let confidence = 0;

  // Classification quality (30% weight)
  confidence += factors.classificationConfidence * 0.30;

  // GOLDEN improvement extent (25% weight)
  confidence += (factors.dimensionsImproved / 6) * 0.25;

  // Anti-pattern status (15% weight)
  confidence += factors.antiPatternFree * 0.15;

  // Template applicability (15% weight)
  confidence += factors.templateMatch * 0.15;

  // Context availability (15% weight)
  confidence += factors.contextRichness * 0.15;

  // Clamp to reasonable range
  return Math.max(0.30, Math.min(0.95, confidence));
}

/**
 * Count how many GOLDEN dimensions will be improved
 */
export function countImprovedDimensions(evaluation: GuidelineEvaluation): number {
  const dimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
  let improved = 0;

  for (const dim of dimensions) {
    // If dimension score is below 0.5, rewriting will likely improve it
    if (evaluation.goldenScore[dim] < 0.5) {
      improved++;
    }
  }

  return improved;
}

/**
 * Calculate anti-pattern free score
 */
export function calculateAntiPatternFreeScore(antiPatterns: Array<{ severity: string }>): number {
  if (antiPatterns.length === 0) return 1.0;

  // High severity patterns reduce score more
  let penalty = 0;
  for (const pattern of antiPatterns) {
    if (pattern.severity === 'high') penalty += 0.3;
    else if (pattern.severity === 'medium') penalty += 0.15;
    else penalty += 0.05;
  }

  return Math.max(0, 1 - penalty);
}

/**
 * Calculate context richness score
 */
export function calculateContextRichness(context?: SessionContext): number {
  if (!context) return 0.2;

  let richness = 0.3; // Base for having any context

  if (context.techStack.length > 0) richness += 0.2;
  if (context.currentTask && context.currentTask !== '작업 진행 중') richness += 0.15;
  if (context.recentFiles.length > 0) richness += 0.15;
  if (context.lastExchange) richness += 0.1;
  if (context.gitBranch) richness += 0.1;

  return Math.min(1, richness);
}
