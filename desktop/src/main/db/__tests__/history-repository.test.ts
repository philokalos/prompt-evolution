/**
 * Tests for db/history-repository.ts
 * PromptLint - History Repository CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock state
const mockState = vi.hoisted(() => ({
  prepareResult: {
    run: vi.fn(() => ({ lastInsertRowid: 1 })),
    get: vi.fn(() => undefined),
    all: vi.fn(() => []),
  },
  mockDb: {
    prepare: vi.fn(() => mockState.prepareResult),
  },
}));

// Mock connection
vi.mock('../connection.js', () => ({
  getDatabase: () => mockState.mockDb,
}));

// Import after mocking
import {
  saveAnalysis,
  getRecentAnalyses,
  getScoreTrend,
  getGoldenAverages,
  getTopWeaknesses,
  getWeeklyStats,
  getMonthlyStats,
  getImprovementAnalysis,
  getAnalysesByProject,
  getProjectGoldenAverages,
  getProjectWeaknesses,
  getHighScoringPrompts,
  getSimilarPromptsByCategory,
  getStats,
  type PromptHistoryRecord,
} from '../history-repository.js';

// Factory function for mock records
function createMockRecord(overrides: Partial<PromptHistoryRecord> = {}): PromptHistoryRecord {
  return {
    promptText: 'Test prompt',
    overallScore: 75,
    grade: 'B',
    goldenScores: {
      goal: 80,
      output: 70,
      limits: 75,
      data: 70,
      evaluation: 80,
      next: 75,
    },
    issues: [{ severity: 'medium', message: 'Test issue', suggestion: 'Fix it' }],
    improvedPrompt: 'Improved test prompt',
    sourceApp: 'VS Code',
    projectPath: '/test/project',
    intent: 'instruction',
    category: 'code-generation',
    ...overrides,
  };
}

// Factory for DB row format
function createMockDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    prompt_text: 'Test prompt',
    overall_score: 75,
    grade: 'B',
    golden_goal: 80,
    golden_output: 70,
    golden_limits: 75,
    golden_data: 70,
    golden_evaluation: 80,
    golden_next: 75,
    issues_json: JSON.stringify([{ severity: 'medium', message: 'Test issue', suggestion: 'Fix it' }]),
    improved_prompt: 'Improved test prompt',
    source_app: 'VS Code',
    project_path: '/test/project',
    intent: 'instruction',
    category: 'code-generation',
    analyzed_at: '2024-01-01T12:00:00Z',
    ...overrides,
  };
}

describe('history-repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    mockState.prepareResult.run.mockReturnValue({ lastInsertRowid: 1 });
    mockState.prepareResult.get.mockReturnValue(undefined);
    mockState.prepareResult.all.mockReturnValue([]);
  });

  describe('saveAnalysis', () => {
    it('should save a complete analysis record', () => {
      const record = createMockRecord();

      const id = saveAnalysis(record);

      expect(id).toBe(1);
      expect(mockState.mockDb.prepare).toHaveBeenCalled();
      expect(mockState.prepareResult.run).toHaveBeenCalled();
    });

    it('should pass all fields to the prepared statement', () => {
      const record = createMockRecord();

      saveAnalysis(record);

      expect(mockState.prepareResult.run).toHaveBeenCalledWith(
        record.promptText,
        record.overallScore,
        record.grade,
        record.goldenScores.goal,
        record.goldenScores.output,
        record.goldenScores.limits,
        record.goldenScores.data,
        record.goldenScores.evaluation,
        record.goldenScores.next,
        JSON.stringify(record.issues),
        record.improvedPrompt,
        record.sourceApp,
        record.projectPath,
        record.intent,
        record.category
      );
    });

    it('should handle null optional fields', () => {
      const record = createMockRecord({
        issues: undefined,
        improvedPrompt: undefined,
        sourceApp: undefined,
        projectPath: undefined,
        intent: undefined,
        category: undefined,
      });

      saveAnalysis(record);

      const runCall = mockState.prepareResult.run.mock.calls[0];
      expect(runCall[9]).toBeNull(); // issues_json
      expect(runCall[10]).toBeNull(); // improved_prompt
      expect(runCall[11]).toBeNull(); // source_app
      expect(runCall[12]).toBeNull(); // project_path
      expect(runCall[13]).toBeNull(); // intent
      expect(runCall[14]).toBeNull(); // category
    });

    it('should update weakness tracking when issues exist', () => {
      const record = createMockRecord({
        goldenScores: {
          goal: 50, // Below threshold
          output: 70,
          limits: 40, // Below threshold
          data: 70,
          evaluation: 80,
          next: 30, // Below threshold
        },
      });

      saveAnalysis(record);

      // Should call prepare multiple times for weakness tracking
      expect(mockState.mockDb.prepare).toHaveBeenCalled();
    });

    it('should not update weakness tracking when no issues', () => {
      const record = createMockRecord({ issues: undefined });

      // Clear prepare calls before the test
      mockState.mockDb.prepare.mockClear();

      saveAnalysis(record);

      // Only the main insert statement should be called
      expect(mockState.mockDb.prepare).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRecentAnalyses', () => {
    it('should return empty array when no records', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getRecentAnalyses();

      expect(result).toEqual([]);
    });

    it('should return mapped records', () => {
      const mockRow = createMockDbRow();
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getRecentAnalyses();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        promptText: 'Test prompt',
        overallScore: 75,
        grade: 'B',
        goldenScores: {
          goal: 80,
          output: 70,
          limits: 75,
          data: 70,
          evaluation: 80,
          next: 75,
        },
        issues: [{ severity: 'medium', message: 'Test issue', suggestion: 'Fix it' }],
        improvedPrompt: 'Improved test prompt',
        sourceApp: 'VS Code',
        analyzedAt: expect.any(Date),
      });
    });

    it('should use default limit of 30', () => {
      getRecentAnalyses();

      expect(mockState.prepareResult.all).toHaveBeenCalledWith(30);
    });

    it('should use custom limit', () => {
      getRecentAnalyses(10);

      expect(mockState.prepareResult.all).toHaveBeenCalledWith(10);
    });

    it('should handle null issues_json', () => {
      const mockRow = createMockDbRow({ issues_json: null });
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getRecentAnalyses();

      expect(result[0].issues).toEqual([]);
    });

    it('should handle null improved_prompt', () => {
      const mockRow = createMockDbRow({ improved_prompt: null });
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getRecentAnalyses();

      expect(result[0].improvedPrompt).toBeUndefined();
    });

    it('should handle null source_app', () => {
      const mockRow = createMockDbRow({ source_app: null });
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getRecentAnalyses();

      expect(result[0].sourceApp).toBeUndefined();
    });
  });

  describe('getScoreTrend', () => {
    it('should return empty array when no data', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getScoreTrend();

      expect(result).toEqual([]);
    });

    it('should return mapped trend data', () => {
      mockState.prepareResult.all.mockReturnValue([
        { date: '2024-01-01', avg_score: 75.5, count: 5 },
        { date: '2024-01-02', avg_score: 80.2, count: 3 },
      ]);

      const result = getScoreTrend();

      expect(result).toEqual([
        { date: '2024-01-01', avgScore: 76, count: 5 },
        { date: '2024-01-02', avgScore: 80, count: 3 },
      ]);
    });

    it('should use default 30 days', () => {
      getScoreTrend();

      expect(mockState.prepareResult.all).toHaveBeenCalledWith(30);
    });

    it('should use custom days', () => {
      getScoreTrend(7);

      expect(mockState.prepareResult.all).toHaveBeenCalledWith(7);
    });
  });

  describe('getGoldenAverages', () => {
    it('should return all dimensions with default values', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: null,
        output: null,
        limits: null,
        data: null,
        evaluation: null,
        next: null,
      });

      const result = getGoldenAverages();

      expect(result).toEqual({
        goal: 0,
        output: 0,
        limits: 0,
        data: 0,
        evaluation: 0,
        next: 0,
      });
    });

    it('should return rounded averages', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: 80.4,
        output: 75.6,
        limits: 70.5,
        data: 65.4,
        evaluation: 85.9,
        next: 60.1,
      });

      const result = getGoldenAverages();

      expect(result).toEqual({
        goal: 80,
        output: 76,
        limits: 71,
        data: 65,
        evaluation: 86,
        next: 60,
      });
    });

    it('should use default 30 days', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: 80, output: 70, limits: 75, data: 70, evaluation: 80, next: 75,
      });

      getGoldenAverages();

      expect(mockState.prepareResult.get).toHaveBeenCalledWith(30);
    });
  });

  describe('getTopWeaknesses', () => {
    it('should return empty array when no weaknesses', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getTopWeaknesses();

      expect(result).toEqual([]);
    });

    it('should return mapped weaknesses', () => {
      mockState.prepareResult.all.mockReturnValue([
        { weakness_type: '목표 명확성', frequency: 10, last_seen_at: '2024-01-01T12:00:00Z' },
        { weakness_type: '출력 형식', frequency: 5, last_seen_at: '2024-01-02T12:00:00Z' },
      ]);

      const result = getTopWeaknesses();

      expect(result).toEqual([
        { type: '목표 명확성', frequency: 10, lastSeen: expect.any(Date) },
        { type: '출력 형식', frequency: 5, lastSeen: expect.any(Date) },
      ]);
    });

    it('should use default limit of 3', () => {
      getTopWeaknesses();

      expect(mockState.prepareResult.all).toHaveBeenCalledWith(3);
    });
  });

  describe('getWeeklyStats', () => {
    it('should return empty array when no data', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getWeeklyStats();

      expect(result).toEqual([]);
    });

    it('should return weekly stats with improvement', () => {
      mockState.prepareResult.all.mockReturnValue([
        { week_start: '2024-01-01', avg_score: 70.5, count: 10, improvement: null },
        { week_start: '2024-01-08', avg_score: 75.8, count: 15, improvement: 5.3 },
      ]);

      const result = getWeeklyStats();

      expect(result).toEqual([
        { weekStart: '2024-01-01', avgScore: 71, count: 10, improvement: 0 },
        { weekStart: '2024-01-08', avgScore: 76, count: 15, improvement: 5 },
      ]);
    });

    it('should use default 4 weeks', () => {
      getWeeklyStats();

      expect(mockState.prepareResult.all).toHaveBeenCalledWith(28); // 4 * 7
    });
  });

  describe('getMonthlyStats', () => {
    it('should return empty array when no data', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getMonthlyStats();

      expect(result).toEqual([]);
    });

    it('should return monthly stats with grade distribution', () => {
      // First call returns monthly averages
      mockState.prepareResult.all
        .mockReturnValueOnce([
          { month: '2024-01', avg_score: 70.5, count: 50 },
        ])
        .mockReturnValueOnce([
          { month: '2024-01', grade: 'A', count: 10 },
          { month: '2024-01', grade: 'B', count: 25 },
          { month: '2024-01', grade: 'C', count: 15 },
        ]);

      const result = getMonthlyStats();

      expect(result).toEqual([
        {
          month: '2024-01',
          avgScore: 71,
          count: 50,
          gradeDistribution: { A: 10, B: 25, C: 15 },
        },
      ]);
    });
  });

  describe('getImprovementAnalysis', () => {
    it('should return improvement analysis with all fields', () => {
      // Mock multiple prepare calls
      mockState.prepareResult.get
        .mockReturnValueOnce({ improvement: 10.5 }) // improvement
        .mockReturnValueOnce({ goal: 80, output: 70, limits: 75, data: 65, evaluation: 85, next: 60 }) // dimensions
        .mockReturnValueOnce({ streak: 5 }) // streak
        .mockReturnValueOnce({ date: '2024-01-01', value: 95 }) // first A
        .mockReturnValueOnce({ date: '2024-01-05', value: 98 }); // highest score

      const result = getImprovementAnalysis();

      expect(result.overallImprovement).toBe(11);
      expect(result.bestDimension).toBe('evaluation');
      expect(result.worstDimension).toBe('next');
      expect(result.streak).toBe(5);
      expect(result.milestones).toHaveLength(2);
    });

    it('should handle null improvement', () => {
      mockState.prepareResult.get
        .mockReturnValueOnce({ improvement: null })
        .mockReturnValueOnce({ goal: 80, output: 70, limits: 75, data: 65, evaluation: 85, next: 60 })
        .mockReturnValueOnce({ streak: 0 })
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({ date: null, value: null });

      const result = getImprovementAnalysis();

      expect(result.overallImprovement).toBe(0);
    });

    it('should handle no first A grade', () => {
      mockState.prepareResult.get
        .mockReturnValueOnce({ improvement: 5 })
        .mockReturnValueOnce({ goal: 80, output: 70, limits: 75, data: 65, evaluation: 85, next: 60 })
        .mockReturnValueOnce({ streak: 3 })
        .mockReturnValueOnce(undefined) // no first A
        .mockReturnValueOnce({ date: '2024-01-01', value: 78 });

      const result = getImprovementAnalysis();

      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].type).toBe('highest_score');
    });
  });

  describe('getAnalysesByProject', () => {
    it('should return empty array when no records', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getAnalysesByProject('/test/project');

      expect(result).toEqual([]);
    });

    it('should return mapped records with all fields', () => {
      const mockRow = createMockDbRow();
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getAnalysesByProject('/test/project');

      expect(result).toHaveLength(1);
      expect(result[0].projectPath).toBe('/test/project');
      expect(result[0].intent).toBe('instruction');
      expect(result[0].category).toBe('code-generation');
    });

    it('should pass project path and limit', () => {
      getAnalysesByProject('/my/project', 10);

      expect(mockState.prepareResult.all).toHaveBeenCalledWith('/my/project', 10);
    });
  });

  describe('getProjectGoldenAverages', () => {
    it('should return null when no records', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: null, output: null, limits: null, data: null, evaluation: null, next: null, count: 0,
      });

      const result = getProjectGoldenAverages('/test/project');

      expect(result).toBeNull();
    });

    it('should return averages when records exist', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: 80.5, output: 70.3, limits: 75.7, data: 65.2, evaluation: 85.9, next: 60.1, count: 10,
      });

      const result = getProjectGoldenAverages('/test/project');

      expect(result).toEqual({
        goal: 81,
        output: 70,
        limits: 76,
        data: 65,
        evaluation: 86,
        next: 60,
      });
    });

    it('should pass project path', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: 80, output: 70, limits: 75, data: 70, evaluation: 80, next: 75, count: 5,
      });

      getProjectGoldenAverages('/my/project');

      expect(mockState.prepareResult.get).toHaveBeenCalledWith('/my/project');
    });
  });

  describe('getProjectWeaknesses', () => {
    it('should return empty array when no weaknesses', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: 80, output: 80, limits: 80, data: 80, evaluation: 80, next: 80,
        goal_weak: 0, output_weak: 0, limits_weak: 0, data_weak: 0, eval_weak: 0, next_weak: 0,
      });

      const result = getProjectWeaknesses('/test/project');

      expect(result).toEqual([]);
    });

    it('should return weaknesses sorted by frequency', () => {
      mockState.prepareResult.get.mockReturnValue({
        goal: 50, output: 70, limits: 40, data: 70, evaluation: 80, next: 30,
        goal_weak: 5, output_weak: 0, limits_weak: 8, data_weak: 0, eval_weak: 0, next_weak: 10,
      });

      const result = getProjectWeaknesses('/test/project');

      expect(result).toHaveLength(3);
      expect(result[0].dimension).toBe('다음 단계'); // Highest weak count
      expect(result[0].belowThresholdCount).toBe(10);
      expect(result[1].dimension).toBe('제약 조건');
      expect(result[2].dimension).toBe('목표 명확성');
    });
  });

  describe('getHighScoringPrompts', () => {
    it('should return empty array when no high-scoring prompts', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getHighScoringPrompts('/test/project');

      expect(result).toEqual([]);
    });

    it('should return mapped high-scoring records', () => {
      const mockRow = createMockDbRow({ overall_score: 90 });
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getHighScoringPrompts('/test/project');

      expect(result).toHaveLength(1);
      expect(result[0].overallScore).toBe(90);
    });

    it('should use default minScore and limit', () => {
      getHighScoringPrompts('/test/project');

      expect(mockState.prepareResult.all).toHaveBeenCalledWith('/test/project', 80, 5);
    });

    it('should use custom minScore and limit', () => {
      getHighScoringPrompts('/test/project', 90, 3);

      expect(mockState.prepareResult.all).toHaveBeenCalledWith('/test/project', 90, 3);
    });
  });

  describe('getSimilarPromptsByCategory', () => {
    it('should return empty array when no similar prompts', () => {
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getSimilarPromptsByCategory('code-generation');

      expect(result).toEqual([]);
    });

    it('should return prompts with same category', () => {
      const mockRow = createMockDbRow({ category: 'bug-fix' });
      mockState.prepareResult.all.mockReturnValue([mockRow]);

      const result = getSimilarPromptsByCategory('bug-fix');

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('bug-fix');
    });

    it('should filter by project path when provided', () => {
      getSimilarPromptsByCategory('refactoring', '/test/project');

      expect(mockState.prepareResult.all).toHaveBeenCalledWith('refactoring', '/test/project', 10);
    });

    it('should use default limit without project path', () => {
      getSimilarPromptsByCategory('testing');

      expect(mockState.prepareResult.all).toHaveBeenCalledWith('testing', 10);
    });

    it('should use custom limit', () => {
      getSimilarPromptsByCategory('documentation', undefined, 5);

      expect(mockState.prepareResult.all).toHaveBeenCalledWith('documentation', 5);
    });
  });

  describe('getStats', () => {
    it('should return statistics summary', () => {
      mockState.prepareResult.get
        .mockReturnValueOnce({ total: 100, avg: 75.5 }) // stats
        .mockReturnValueOnce({ recent: 80, previous: 70 }); // trend
      mockState.prepareResult.all.mockReturnValue([
        { grade: 'A', count: 10 },
        { grade: 'B', count: 40 },
        { grade: 'C', count: 30 },
        { grade: 'D', count: 15 },
        { grade: 'F', count: 5 },
      ]);

      const result = getStats();

      expect(result.totalAnalyses).toBe(100);
      expect(result.averageScore).toBe(76);
      expect(result.gradeDistribution).toEqual({
        A: 10, B: 40, C: 30, D: 15, F: 5,
      });
      expect(result.recentTrend).toBe('improving');
    });

    it('should return declining trend', () => {
      mockState.prepareResult.get
        .mockReturnValueOnce({ total: 50, avg: 70 })
        .mockReturnValueOnce({ recent: 65, previous: 75 });
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getStats();

      expect(result.recentTrend).toBe('declining');
    });

    it('should return stable trend', () => {
      mockState.prepareResult.get
        .mockReturnValueOnce({ total: 50, avg: 70 })
        .mockReturnValueOnce({ recent: 72, previous: 70 });
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getStats();

      expect(result.recentTrend).toBe('stable');
    });

    it('should handle null values', () => {
      mockState.prepareResult.get
        .mockReturnValueOnce({ total: 0, avg: null })
        .mockReturnValueOnce({ recent: null, previous: null });
      mockState.prepareResult.all.mockReturnValue([]);

      const result = getStats();

      expect(result.totalAnalyses).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.recentTrend).toBe('stable');
    });
  });
});
