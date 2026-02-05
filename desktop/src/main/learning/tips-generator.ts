/**
 * Personal Tips Generator
 * Generates personalized tips based on GOLDEN evaluation results
 *
 * Extracted from learning-engine.ts
 */

import type { GuidelineEvaluation } from './module-loader.js';

/**
 * Area-specific improvement messages
 */
const AREA_MESSAGES: Record<string, string> = {
  goal: '목표를 더 명확하게 정의해보세요',
  output: '원하는 출력 형식을 명시해보세요',
  limits: '제약조건이나 범위를 추가해보세요',
  data: '필요한 컨텍스트나 데이터를 제공해보세요',
  evaluation: '성공 기준을 정의해보세요',
  next: '후속 작업이나 예상 결과를 언급해보세요',
};

/**
 * Score threshold for considering an area as needing improvement
 */
const LOW_SCORE_THRESHOLD = 0.5;

/**
 * Maximum number of tips to generate
 */
const MAX_TIPS = 3;

/**
 * Maximum number of recommendations to include
 */
const MAX_RECOMMENDATIONS = 2;

/**
 * Generate personal tips based on GOLDEN evaluation
 */
export function generatePersonalTips(evaluation: GuidelineEvaluation): string[] {
  const tips: string[] = [];

  // Add recommendations from evaluation
  evaluation.recommendations.slice(0, MAX_RECOMMENDATIONS).forEach((rec) => {
    tips.push(rec);
  });

  // Add tips based on lowest GOLDEN scores
  const goldenEntries = Object.entries(evaluation.goldenScore)
    .filter(([key]) => key !== 'total')
    .sort((a, b) => (a[1] as number) - (b[1] as number));

  const lowestArea = goldenEntries[0];
  if (lowestArea && (lowestArea[1] as number) < LOW_SCORE_THRESHOLD) {
    const message = AREA_MESSAGES[lowestArea[0]];
    if (message) {
      tips.push(message);
    }
  }

  return tips.filter(Boolean).slice(0, MAX_TIPS);
}

/**
 * Get all GOLDEN dimensions with their scores, sorted by score
 */
export function getGoldenDimensionsByScore(
  goldenScore: Record<string, number>
): Array<{ dimension: string; score: number; message: string }> {
  return Object.entries(goldenScore)
    .filter(([key]) => key !== 'total')
    .map(([dimension, score]) => ({
      dimension,
      score: score as number,
      message: AREA_MESSAGES[dimension] || '',
    }))
    .sort((a, b) => a.score - b.score);
}

/**
 * Get dimensions that need improvement
 */
export function getDimensionsNeedingImprovement(
  goldenScore: Record<string, number>,
  threshold = LOW_SCORE_THRESHOLD
): Array<{ dimension: string; score: number; message: string }> {
  return getGoldenDimensionsByScore(goldenScore).filter(
    (item) => item.score < threshold
  );
}
