/**
 * Tests for history-pattern-analyzer.ts
 * PromptLint - Analyzes user's prompt history to provide personalized recommendations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PromptHistoryRecord } from '../db/history-repository.js';

// Mock the history-repository module
const mockRepository = vi.hoisted(() => ({
  getAnalysesByProject: vi.fn(() => []),
  getProjectGoldenAverages: vi.fn(() => null),
  getProjectWeaknesses: vi.fn(() => []),
  getHighScoringPrompts: vi.fn(() => []),
  getSimilarPromptsByCategory: vi.fn(() => []),
}));

vi.mock('../db/history-repository.js', () => mockRepository);

// Import after mocking
import {
  analyzeProjectPatterns,
  getContextRecommendations,
  enrichAnalysisWithHistory,
  type HistoryRecommendation,
  type ProjectPatternAnalysis,
} from '../history-pattern-analyzer.js';

describe('history-pattern-analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create mock prompt history records
  function createMockPromptRecord(
    overrides: Partial<PromptHistoryRecord> = {}
  ): PromptHistoryRecord {
    return {
      id: 1,
      promptText: 'Test prompt text for analysis',
      overallScore: 75,
      grade: 'B',
      category: 'code-generation',
      projectPath: '/test/project',
      createdAt: new Date().toISOString(),
      goldenScores: {
        goal: 80,
        output: 70,
        limits: 65,
        data: 75,
        evaluation: 70,
        next: 60,
      },
      ...overrides,
    };
  }

  describe('analyzeProjectPatterns', () => {
    const projectPath = '/Users/test/project';

    it('should return empty analysis when no history exists', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([]);
      mockRepository.getProjectGoldenAverages.mockReturnValue(null);
      mockRepository.getProjectWeaknesses.mockReturnValue([]);
      mockRepository.getHighScoringPrompts.mockReturnValue([]);

      const result = analyzeProjectPatterns(projectPath);

      expect(result.projectPath).toBe(projectPath);
      expect(result.totalAnalyses).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.goldenAverages).toBeNull();
      expect(result.weaknesses).toEqual([]);
      // Even with no history, generates improvement recommendation because averageScore=0 < 60
      expect(result.recommendations.length).toBe(1);
      expect(result.recommendations[0].type).toBe('improvement');
      expect(result.recommendations[0].priority).toBe('high');
      expect(result.highScoringExamples).toEqual([]);
    });

    it('should calculate average score from analyses', () => {
      const analyses = [
        createMockPromptRecord({ overallScore: 60 }),
        createMockPromptRecord({ overallScore: 80 }),
        createMockPromptRecord({ overallScore: 70 }),
      ];
      mockRepository.getAnalysesByProject.mockReturnValue(analyses);

      const result = analyzeProjectPatterns(projectPath);

      expect(result.totalAnalyses).toBe(3);
      expect(result.averageScore).toBe(70); // (60 + 80 + 70) / 3 = 70
    });

    it('should generate weakness recommendation for top weakness', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 40, belowThresholdCount: 5 },
      ]);

      const result = analyzeProjectPatterns(projectPath);

      const weaknessRec = result.recommendations.find((r) => r.type === 'weakness');
      expect(weaknessRec).toBeDefined();
      expect(weaknessRec?.priority).toBe('high');
      expect(weaknessRec?.dimension).toBe('goal');
      expect(weaknessRec?.improvement).toBe(20); // 60 - 40
    });

    it('should generate second weakness recommendation if multiple weaknesses exist', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 40, belowThresholdCount: 5 },
        { dimension: '출력 형식', averageScore: 45, belowThresholdCount: 3 },
      ]);

      const result = analyzeProjectPatterns(projectPath);

      const weaknessRecs = result.recommendations.filter((r) => r.type === 'weakness');
      expect(weaknessRecs.length).toBe(2);
      expect(weaknessRecs[0].priority).toBe('high');
      expect(weaknessRecs[1].priority).toBe('medium');
      expect(weaknessRecs[1].dimension).toBe('output');
    });

    it('should generate reference recommendation for high-scoring prompts', () => {
      const highScoringPrompt = createMockPromptRecord({
        overallScore: 90,
        grade: 'A',
        promptText: 'This is an excellent prompt example that scored very high',
      });
      mockRepository.getAnalysesByProject.mockReturnValue([highScoringPrompt]);
      mockRepository.getHighScoringPrompts.mockReturnValue([highScoringPrompt]);

      const result = analyzeProjectPatterns(projectPath);

      const referenceRec = result.recommendations.find((r) => r.type === 'reference');
      expect(referenceRec).toBeDefined();
      expect(referenceRec?.priority).toBe('low');
      expect(referenceRec?.examplePrompt).toContain('excellent prompt');
    });

    it('should truncate long example prompts to 150 characters', () => {
      const longPrompt = 'A'.repeat(200);
      const highScoringPrompt = createMockPromptRecord({
        overallScore: 90,
        grade: 'A',
        promptText: longPrompt,
      });
      mockRepository.getHighScoringPrompts.mockReturnValue([highScoringPrompt]);

      const result = analyzeProjectPatterns(projectPath);

      const referenceRec = result.recommendations.find((r) => r.type === 'reference');
      expect(referenceRec?.examplePrompt?.length).toBeLessThanOrEqual(153); // 150 + "..."
      expect(referenceRec?.examplePrompt).toContain('...');
    });

    it('should generate pattern recommendation for low golden averages', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 65 }),
      ]);
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 80,
        output: 50, // lowest
        limits: 70,
        data: 75,
        evaluation: 65,
        next: 60,
      });

      const result = analyzeProjectPatterns(projectPath);

      const patternRec = result.recommendations.find((r) => r.type === 'pattern');
      expect(patternRec).toBeDefined();
      expect(patternRec?.dimension).toBe('output');
      expect(patternRec?.message).toContain('50점');
    });

    it('should not generate pattern recommendation if lowest dimension is above 70', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 85 }),
      ]);
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 80,
        output: 75,
        limits: 80,
        data: 85,
        evaluation: 75,
        next: 72,
      });

      const result = analyzeProjectPatterns(projectPath);

      const patternRec = result.recommendations.find((r) => r.type === 'pattern');
      expect(patternRec).toBeUndefined();
    });

    it('should generate high priority improvement recommendation for low average score', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 45 }),
      ]);

      const result = analyzeProjectPatterns(projectPath);

      const improvementRec = result.recommendations.find((r) => r.type === 'improvement');
      expect(improvementRec).toBeDefined();
      expect(improvementRec?.priority).toBe('high');
      expect(improvementRec?.improvement).toBe(15); // 60 - 45
    });

    it('should generate medium priority improvement recommendation for moderate average score', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 65 }),
      ]);

      const result = analyzeProjectPatterns(projectPath);

      const improvementRec = result.recommendations.find((r) => r.type === 'improvement');
      expect(improvementRec).toBeDefined();
      expect(improvementRec?.priority).toBe('medium');
      expect(improvementRec?.improvement).toBe(10); // 75 - 65
    });

    it('should not generate improvement recommendation for high average score', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 85 }),
      ]);

      const result = analyzeProjectPatterns(projectPath);

      const improvementRec = result.recommendations.find((r) => r.type === 'improvement');
      expect(improvementRec).toBeUndefined();
    });

    it('should include high-scoring examples in result', () => {
      const highScoring = [
        createMockPromptRecord({ overallScore: 95, grade: 'A+' }),
        createMockPromptRecord({ overallScore: 88, grade: 'A' }),
      ];
      mockRepository.getHighScoringPrompts.mockReturnValue(highScoring);

      const result = analyzeProjectPatterns(projectPath);

      expect(result.highScoringExamples).toEqual(highScoring);
    });

    it('should handle all dimension weaknesses', () => {
      const allDimensions = [
        { dimension: '목표 명확성', averageScore: 40, belowThresholdCount: 5 },
        { dimension: '출력 형식', averageScore: 42, belowThresholdCount: 4 },
        { dimension: '제약 조건', averageScore: 45, belowThresholdCount: 3 },
        { dimension: '데이터/컨텍스트', averageScore: 48, belowThresholdCount: 2 },
        { dimension: '평가 기준', averageScore: 50, belowThresholdCount: 2 },
        { dimension: '다음 단계', averageScore: 52, belowThresholdCount: 1 },
      ];
      mockRepository.getProjectWeaknesses.mockReturnValue(allDimensions);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 45 }),
      ]);

      const result = analyzeProjectPatterns(projectPath);

      // Should only include top 2 weaknesses
      const weaknessRecs = result.recommendations.filter((r) => r.type === 'weakness');
      expect(weaknessRecs.length).toBe(2);
    });
  });

  describe('getContextRecommendations', () => {
    const projectPath = '/Users/test/project';

    it('should return empty recommendations when no project and no category', () => {
      const result = getContextRecommendations(undefined, undefined);

      expect(result.basedOnProject).toEqual([]);
      expect(result.basedOnCategory).toEqual([]);
      expect(result.referencePrompts).toEqual([]);
    });

    it('should return project-based recommendations when project path is provided', () => {
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 40, belowThresholdCount: 5 },
      ]);

      const result = getContextRecommendations(undefined, projectPath);

      expect(result.basedOnProject.length).toBeGreaterThan(0);
    });

    it('should limit project recommendations to 3', () => {
      // Create scenario with many recommendations
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 40 }),
      ]);
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 30, belowThresholdCount: 10 },
        { dimension: '출력 형식', averageScore: 35, belowThresholdCount: 8 },
      ]);
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 30,
        output: 35,
        limits: 40,
        data: 45,
        evaluation: 50,
        next: 55,
      });
      mockRepository.getHighScoringPrompts.mockReturnValue([
        createMockPromptRecord({ overallScore: 85 }),
      ]);

      const result = getContextRecommendations(undefined, projectPath);

      expect(result.basedOnProject.length).toBeLessThanOrEqual(3);
    });

    it('should return category-based recommendations when category is provided', () => {
      const similarPrompts = [
        createMockPromptRecord({ overallScore: 70, category: 'code-generation' }),
        createMockPromptRecord({ overallScore: 65, category: 'code-generation' }),
      ];
      mockRepository.getSimilarPromptsByCategory.mockReturnValue(similarPrompts);

      const result = getContextRecommendations('code-generation', undefined);

      expect(result.basedOnCategory.length).toBeGreaterThan(0);
      expect(result.basedOnCategory[0].type).toBe('pattern');
      expect(result.basedOnCategory[0].title).toContain('코드 생성');
    });

    it('should not return category recommendations for unknown category', () => {
      const result = getContextRecommendations('unknown', undefined);

      expect(result.basedOnCategory).toEqual([]);
    });

    it('should include reference recommendation for high-scoring category prompts', () => {
      const similarPrompts = [
        createMockPromptRecord({ overallScore: 85, grade: 'A', category: 'bug-fix' }),
      ];
      mockRepository.getSimilarPromptsByCategory.mockReturnValue(similarPrompts);

      const result = getContextRecommendations('bug-fix', undefined);

      const referenceRec = result.basedOnCategory.find((r) => r.type === 'reference');
      expect(referenceRec).toBeDefined();
      expect(referenceRec?.title).toBe('비슷한 작업의 좋은 예시');
    });

    it('should not include reference for low-scoring category prompts', () => {
      const similarPrompts = [
        createMockPromptRecord({ overallScore: 60, grade: 'C', category: 'bug-fix' }),
      ];
      mockRepository.getSimilarPromptsByCategory.mockReturnValue(similarPrompts);

      const result = getContextRecommendations('bug-fix', undefined);

      const referenceRec = result.basedOnCategory.find((r) => r.type === 'reference');
      expect(referenceRec).toBeUndefined();
    });

    it('should merge reference prompts from project and category', () => {
      const projectPrompts = [
        createMockPromptRecord({ id: 1, overallScore: 90 }),
        createMockPromptRecord({ id: 2, overallScore: 85 }),
      ];
      const categoryPrompts = [
        createMockPromptRecord({ id: 3, overallScore: 88, category: 'testing' }),
        createMockPromptRecord({ id: 4, overallScore: 82, category: 'testing' }),
      ];

      mockRepository.getHighScoringPrompts.mockReturnValue(projectPrompts);
      mockRepository.getSimilarPromptsByCategory.mockReturnValue(categoryPrompts);

      const result = getContextRecommendations('testing', projectPath);

      // Category prompts should come first, then project prompts
      expect(result.referencePrompts.length).toBeLessThanOrEqual(5);
      expect(result.referencePrompts[0].id).toBe(3); // Category prompt first
    });

    it('should handle all category labels correctly', () => {
      const categories = [
        { category: 'code-generation', label: '코드 생성' },
        { category: 'code-review', label: '코드 리뷰' },
        { category: 'bug-fix', label: '버그 수정' },
        { category: 'refactoring', label: '리팩토링' },
        { category: 'explanation', label: '설명/질문' },
        { category: 'documentation', label: '문서화' },
        { category: 'testing', label: '테스트' },
        { category: 'architecture', label: '아키텍처' },
        { category: 'deployment', label: '배포' },
        { category: 'data-analysis', label: '데이터 분석' },
        { category: 'general', label: '일반' },
      ];

      for (const { category, label } of categories) {
        vi.clearAllMocks();
        mockRepository.getSimilarPromptsByCategory.mockReturnValue([
          createMockPromptRecord({ overallScore: 70, category }),
        ]);

        const result = getContextRecommendations(category, undefined);

        expect(result.basedOnCategory[0].title).toContain(label);
      }
    });
  });

  describe('enrichAnalysisWithHistory', () => {
    const projectPath = '/Users/test/project';
    const mockAnalysis = {
      overallScore: 75,
      goldenScores: {
        goal: 80,
        output: 70,
        limits: 75,
        data: 80,
        evaluation: 70,
        next: 75,
      },
      issues: [],
    };

    it('should return empty result when no project path', () => {
      const result = enrichAnalysisWithHistory(mockAnalysis, undefined, undefined);

      expect(result.historyRecommendations).toEqual([]);
      expect(result.comparisonWithHistory).toBeNull();
    });

    it('should compare current score with project average', () => {
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 60,
        output: 55,
        limits: 50,
        data: 55,
        evaluation: 50,
        next: 50,
      });

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, undefined);

      expect(result.comparisonWithHistory).toBeDefined();
      expect(result.comparisonWithHistory?.betterThanAverage).toBe(true);
      // Project avg = (60+55+50+55+50+50)/6 = 53.33 ≈ 53
      // Score diff = 75 - 53 = 22
      expect(result.comparisonWithHistory?.scoreDiff).toBeGreaterThan(0);
    });

    it('should show improvement message for significant improvement (>=10)', () => {
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 60,
        output: 60,
        limits: 60,
        data: 60,
        evaluation: 60,
        next: 60,
      });

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, undefined);

      // Project avg = 60, current = 75, diff = 15
      expect(result.comparisonWithHistory?.improvement).toBe('이전보다 크게 개선되었습니다!');
    });

    it('should show moderate improvement message for 5-9 point improvement', () => {
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 70,
        output: 68,
        limits: 70,
        data: 70,
        evaluation: 68,
        next: 70,
      });

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, undefined);

      // Project avg ≈ 69, current = 75, diff = 6
      expect(result.comparisonWithHistory?.improvement).toBe('이전보다 개선되었습니다.');
    });

    it('should show negative message for significant decline (>=-10)', () => {
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 90,
        output: 88,
        limits: 90,
        data: 85,
        evaluation: 88,
        next: 85,
      });

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, undefined);

      // Project avg ≈ 88, current = 75, diff = -13
      expect(result.comparisonWithHistory?.betterThanAverage).toBe(false);
      expect(result.comparisonWithHistory?.improvement).toContain('품질이 낮습니다');
    });

    it('should return null improvement message for small differences', () => {
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 75,
        output: 73,
        limits: 75,
        data: 75,
        evaluation: 73,
        next: 75,
      });

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, undefined);

      // Project avg ≈ 74, current = 75, diff = 1
      expect(result.comparisonWithHistory?.improvement).toBeNull();
    });

    it('should combine and sort recommendations by priority', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getSimilarPromptsByCategory.mockReturnValue([
        createMockPromptRecord({ overallScore: 70, category: 'testing' }),
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, 'testing');

      // Verify recommendations are sorted by priority
      const priorities = result.historyRecommendations.map((r) => r.priority);
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < priorities.length; i++) {
        expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(
          priorityOrder[priorities[i - 1]]
        );
      }
    });

    it('should limit recommendations to 5', () => {
      // Create many recommendations scenario
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 30, belowThresholdCount: 10 },
        { dimension: '출력 형식', averageScore: 35, belowThresholdCount: 8 },
      ]);
      mockRepository.getProjectGoldenAverages.mockReturnValue({
        goal: 30,
        output: 35,
        limits: 40,
        data: 45,
        evaluation: 50,
        next: 55,
      });
      mockRepository.getHighScoringPrompts.mockReturnValue([
        createMockPromptRecord({ overallScore: 85 }),
      ]);
      mockRepository.getSimilarPromptsByCategory.mockReturnValue([
        createMockPromptRecord({ overallScore: 80, category: 'testing' }),
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 40 }),
      ]);

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, 'testing');

      expect(result.historyRecommendations.length).toBeLessThanOrEqual(5);
    });

    it('should handle missing project averages gracefully', () => {
      mockRepository.getProjectGoldenAverages.mockReturnValue(null);

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, undefined);

      expect(result.comparisonWithHistory).toBeNull();
    });

    it('should include category-based recommendations when category provided', () => {
      mockRepository.getSimilarPromptsByCategory.mockReturnValue([
        createMockPromptRecord({ overallScore: 70, category: 'documentation' }),
      ]);

      const result = enrichAnalysisWithHistory(mockAnalysis, projectPath, 'documentation');

      const categoryRec = result.historyRecommendations.find((r) =>
        r.title.includes('문서화')
      );
      expect(categoryRec).toBeDefined();
    });
  });

  describe('DIMENSION_TIPS mapping', () => {
    it('should map goal dimension correctly', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '목표 명확성', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      const rec = result.recommendations.find((r) => r.dimension === 'goal');
      expect(rec).toBeDefined();
      expect(rec?.message).toContain('목적');
    });

    it('should map output dimension correctly', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '출력 형식', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      const rec = result.recommendations.find((r) => r.dimension === 'output');
      expect(rec).toBeDefined();
      expect(rec?.message).toContain('출력 형식');
    });

    it('should map limits dimension correctly', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '제약 조건', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      const rec = result.recommendations.find((r) => r.dimension === 'limits');
      expect(rec).toBeDefined();
      expect(rec?.message).toContain('제약 조건');
    });

    it('should map data dimension correctly', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '데이터/컨텍스트', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      const rec = result.recommendations.find((r) => r.dimension === 'data');
      expect(rec).toBeDefined();
      expect(rec?.message).toContain('배경 정보');
    });

    it('should map evaluation dimension correctly', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '평가 기준', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      const rec = result.recommendations.find((r) => r.dimension === 'evaluation');
      expect(rec).toBeDefined();
      expect(rec?.message).toContain('성공 기준');
    });

    it('should map next dimension correctly', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: '다음 단계', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      const rec = result.recommendations.find((r) => r.dimension === 'next');
      expect(rec).toBeDefined();
      expect(rec?.message).toContain('후속 작업');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown dimension names gracefully', () => {
      mockRepository.getProjectWeaknesses.mockReturnValue([
        { dimension: 'Unknown Dimension', averageScore: 40, belowThresholdCount: 5 },
      ]);
      mockRepository.getAnalysesByProject.mockReturnValue([
        createMockPromptRecord({ overallScore: 50 }),
      ]);

      const result = analyzeProjectPatterns('/test');

      // Should not crash, just not create a recommendation for unknown dimension
      const unknownRec = result.recommendations.find((r) => r.dimension === undefined);
      // The weakness recommendation should be skipped for unknown dimensions
      const weaknessRecs = result.recommendations.filter((r) => r.type === 'weakness');
      expect(weaknessRecs.length).toBe(0);
    });

    it('should handle empty category label lookup', () => {
      mockRepository.getSimilarPromptsByCategory.mockReturnValue([
        createMockPromptRecord({ overallScore: 70, category: 'nonexistent-category' }),
      ]);

      const result = getContextRecommendations('nonexistent-category', undefined);

      // Should use the category name itself as the label
      expect(result.basedOnCategory[0].title).toContain('nonexistent-category');
    });

    it('should handle prompt text shorter than truncation limit', () => {
      const shortPrompt = createMockPromptRecord({
        overallScore: 90,
        promptText: 'Short prompt',
      });
      mockRepository.getHighScoringPrompts.mockReturnValue([shortPrompt]);

      const result = analyzeProjectPatterns('/test');

      const referenceRec = result.recommendations.find((r) => r.type === 'reference');
      expect(referenceRec?.examplePrompt).toBe('Short prompt');
      expect(referenceRec?.examplePrompt).not.toContain('...');
    });

    it('should handle exactly 150 character prompt', () => {
      const exactPrompt = createMockPromptRecord({
        overallScore: 90,
        promptText: 'A'.repeat(150),
      });
      mockRepository.getHighScoringPrompts.mockReturnValue([exactPrompt]);

      const result = analyzeProjectPatterns('/test');

      const referenceRec = result.recommendations.find((r) => r.type === 'reference');
      expect(referenceRec?.examplePrompt).toBe('A'.repeat(150));
      expect(referenceRec?.examplePrompt).not.toContain('...');
    });
  });
});
