/**
 * Tips Generator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generatePersonalTips,
  getGoldenDimensionsByScore,
  getDimensionsNeedingImprovement,
} from '../tips-generator.js';
import type { GuidelineEvaluation } from '../module-loader.js';

describe('Tips Generator', () => {
  const createMockEvaluation = (
    overrides: Partial<{
      goldenScore: Record<string, number>;
      recommendations: string[];
    }> = {}
  ): GuidelineEvaluation => ({
    overallScore: 0.7,
    guidelineScores: [],
    goldenScore: {
      goal: 0.8,
      output: 0.7,
      limits: 0.6,
      data: 0.5,
      evaluation: 0.4,
      next: 0.3,
      total: 0.55,
      ...overrides.goldenScore,
    },
    antiPatterns: [],
    recommendations: overrides.recommendations || ['Add context', 'Be specific'],
    grade: 'B',
  });

  describe('generatePersonalTips', () => {
    it('should include recommendations from evaluation', () => {
      const evaluation = createMockEvaluation({
        recommendations: ['Recommendation 1', 'Recommendation 2'],
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips).toContain('Recommendation 1');
      expect(tips).toContain('Recommendation 2');
    });

    it('should limit recommendations to MAX_RECOMMENDATIONS (2)', () => {
      const evaluation = createMockEvaluation({
        recommendations: ['Rec 1', 'Rec 2', 'Rec 3', 'Rec 4'],
      });

      const tips = generatePersonalTips(evaluation);

      // Should have 2 recommendations + 1 area tip (max 3 total)
      expect(tips.length).toBeLessThanOrEqual(3);
    });

    it('should add area message for lowest scoring dimension below threshold', () => {
      const evaluation = createMockEvaluation({
        goldenScore: {
          goal: 0.9,
          output: 0.8,
          limits: 0.7,
          data: 0.6,
          evaluation: 0.5,
          next: 0.3, // Lowest and below 0.5 threshold
          total: 0.65,
        },
        recommendations: [],
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips).toContain('후속 작업이나 예상 결과를 언급해보세요');
    });

    it('should not add area message if lowest dimension is above threshold', () => {
      const evaluation = createMockEvaluation({
        goldenScore: {
          goal: 0.9,
          output: 0.8,
          limits: 0.7,
          data: 0.6,
          evaluation: 0.6,
          next: 0.55, // Above 0.5 threshold
          total: 0.7,
        },
        recommendations: [],
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips).toHaveLength(0);
    });

    it('should return max 3 tips', () => {
      const evaluation = createMockEvaluation({
        recommendations: ['Rec 1', 'Rec 2', 'Rec 3'],
        goldenScore: {
          goal: 0.9,
          output: 0.8,
          limits: 0.7,
          data: 0.6,
          evaluation: 0.5,
          next: 0.2, // Very low, should trigger area message
          total: 0.6,
        },
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips.length).toBeLessThanOrEqual(3);
    });

    it('should filter out falsy values', () => {
      const evaluation = createMockEvaluation({
        recommendations: ['Valid tip', '', 'Another tip'],
        goldenScore: {
          goal: 0.9,
          output: 0.9,
          limits: 0.9,
          data: 0.9,
          evaluation: 0.9,
          next: 0.9,
          total: 0.9,
        },
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips.every((tip) => tip !== '')).toBe(true);
    });

    it('should handle empty recommendations', () => {
      const evaluation = createMockEvaluation({
        recommendations: [],
        goldenScore: {
          goal: 0.9,
          output: 0.9,
          limits: 0.9,
          data: 0.9,
          evaluation: 0.9,
          next: 0.9,
          total: 0.9,
        },
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips).toEqual([]);
    });

    it('should add message for goal dimension when lowest', () => {
      const evaluation = createMockEvaluation({
        goldenScore: {
          goal: 0.2,
          output: 0.8,
          limits: 0.8,
          data: 0.8,
          evaluation: 0.8,
          next: 0.8,
          total: 0.7,
        },
        recommendations: [],
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips).toContain('목표를 더 명확하게 정의해보세요');
    });

    it('should add message for output dimension when lowest', () => {
      const evaluation = createMockEvaluation({
        goldenScore: {
          goal: 0.8,
          output: 0.2,
          limits: 0.8,
          data: 0.8,
          evaluation: 0.8,
          next: 0.8,
          total: 0.7,
        },
        recommendations: [],
      });

      const tips = generatePersonalTips(evaluation);

      expect(tips).toContain('원하는 출력 형식을 명시해보세요');
    });
  });

  describe('getGoldenDimensionsByScore', () => {
    it('should return all dimensions sorted by score ascending', () => {
      const goldenScore = {
        goal: 0.8,
        output: 0.6,
        limits: 0.7,
        data: 0.5,
        evaluation: 0.4,
        next: 0.3,
        total: 0.55,
      };

      const result = getGoldenDimensionsByScore(goldenScore);

      expect(result[0].dimension).toBe('next');
      expect(result[0].score).toBe(0.3);
      expect(result[5].dimension).toBe('goal');
      expect(result[5].score).toBe(0.8);
    });

    it('should exclude total from results', () => {
      const goldenScore = {
        goal: 0.8,
        output: 0.6,
        limits: 0.7,
        data: 0.5,
        evaluation: 0.4,
        next: 0.3,
        total: 0.55,
      };

      const result = getGoldenDimensionsByScore(goldenScore);

      expect(result.find((d) => d.dimension === 'total')).toBeUndefined();
      expect(result).toHaveLength(6);
    });

    it('should include appropriate messages for each dimension', () => {
      const goldenScore = {
        goal: 0.5,
        output: 0.5,
        limits: 0.5,
        data: 0.5,
        evaluation: 0.5,
        next: 0.5,
        total: 0.5,
      };

      const result = getGoldenDimensionsByScore(goldenScore);

      const goalDim = result.find((d) => d.dimension === 'goal');
      expect(goalDim?.message).toBe('목표를 더 명확하게 정의해보세요');

      const outputDim = result.find((d) => d.dimension === 'output');
      expect(outputDim?.message).toBe('원하는 출력 형식을 명시해보세요');

      const limitsDim = result.find((d) => d.dimension === 'limits');
      expect(limitsDim?.message).toBe('제약조건이나 범위를 추가해보세요');

      const dataDim = result.find((d) => d.dimension === 'data');
      expect(dataDim?.message).toBe('필요한 컨텍스트나 데이터를 제공해보세요');

      const evalDim = result.find((d) => d.dimension === 'evaluation');
      expect(evalDim?.message).toBe('성공 기준을 정의해보세요');

      const nextDim = result.find((d) => d.dimension === 'next');
      expect(nextDim?.message).toBe('후속 작업이나 예상 결과를 언급해보세요');
    });

    it('should handle unknown dimensions with empty message', () => {
      const goldenScore = {
        goal: 0.5,
        unknownDim: 0.3,
        total: 0.4,
      };

      const result = getGoldenDimensionsByScore(goldenScore);

      const unknownDim = result.find((d) => d.dimension === 'unknownDim');
      expect(unknownDim?.message).toBe('');
    });
  });

  describe('getDimensionsNeedingImprovement', () => {
    it('should return dimensions below default threshold (0.5)', () => {
      const goldenScore = {
        goal: 0.8,
        output: 0.6,
        limits: 0.4, // Below 0.5
        data: 0.3, // Below 0.5
        evaluation: 0.5, // Equal to threshold, not below
        next: 0.2, // Below 0.5
        total: 0.5,
      };

      const result = getDimensionsNeedingImprovement(goldenScore);

      expect(result).toHaveLength(3);
      expect(result.map((d) => d.dimension)).toEqual(['next', 'data', 'limits']);
    });

    it('should return dimensions below custom threshold', () => {
      const goldenScore = {
        goal: 0.8,
        output: 0.6,
        limits: 0.5,
        data: 0.4,
        evaluation: 0.3,
        next: 0.2,
        total: 0.5,
      };

      const result = getDimensionsNeedingImprovement(goldenScore, 0.7);

      // All dimensions below 0.7: output, limits, data, evaluation, next
      expect(result).toHaveLength(5);
    });

    it('should return empty array when all dimensions meet threshold', () => {
      const goldenScore = {
        goal: 0.8,
        output: 0.7,
        limits: 0.6,
        data: 0.6,
        evaluation: 0.5,
        next: 0.5,
        total: 0.6,
      };

      const result = getDimensionsNeedingImprovement(goldenScore, 0.5);

      expect(result).toHaveLength(0);
    });

    it('should return results sorted by score ascending', () => {
      const goldenScore = {
        goal: 0.4,
        output: 0.3,
        limits: 0.2,
        data: 0.5,
        evaluation: 0.5,
        next: 0.5,
        total: 0.4,
      };

      const result = getDimensionsNeedingImprovement(goldenScore, 0.5);

      expect(result[0].dimension).toBe('limits');
      expect(result[1].dimension).toBe('output');
      expect(result[2].dimension).toBe('goal');
    });

    it('should include messages for improvement areas', () => {
      const goldenScore = {
        goal: 0.3,
        output: 0.9,
        limits: 0.9,
        data: 0.9,
        evaluation: 0.9,
        next: 0.9,
        total: 0.75,
      };

      const result = getDimensionsNeedingImprovement(goldenScore);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('목표를 더 명확하게 정의해보세요');
    });
  });
});
