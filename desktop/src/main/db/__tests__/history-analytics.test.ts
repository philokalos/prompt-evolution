/**
 * History Analytics Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database connection
const mockPrepare = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();

const mockDb = {
  prepare: mockPrepare,
};

vi.mock('../connection.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

describe('History Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup for prepare chain
    mockPrepare.mockReturnValue({
      get: mockGet,
      all: mockAll,
      run: mockRun,
    });
  });

  describe('getScoreTrend', () => {
    it('should return score trend for specified days', async () => {
      mockAll.mockReturnValue([
        { date: '2024-01-01', avg_score: 65.5, count: 10 },
        { date: '2024-01-02', avg_score: 70.2, count: 8 },
      ]);

      const { getScoreTrend } = await import('../history-analytics.js');
      const result = getScoreTrend(30);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalledWith(30);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-01',
        avgScore: 66, // Rounded from 65.5
        count: 10,
      });
    });

    it('should handle empty result', async () => {
      mockAll.mockReturnValue([]);

      const { getScoreTrend } = await import('../history-analytics.js');
      const result = getScoreTrend(7);

      expect(result).toEqual([]);
    });

    it('should round average scores', async () => {
      mockAll.mockReturnValue([
        { date: '2024-01-01', avg_score: 45.4, count: 5 },
        { date: '2024-01-02', avg_score: 45.6, count: 5 },
      ]);

      const { getScoreTrend } = await import('../history-analytics.js');
      const result = getScoreTrend();

      expect(result[0].avgScore).toBe(45);
      expect(result[1].avgScore).toBe(46);
    });
  });

  describe('getGoldenAverages', () => {
    it('should return GOLDEN dimension averages', async () => {
      mockGet.mockReturnValue({
        goal: 60.5,
        output: 55.2,
        limits: 50.8,
        data: 65.3,
        evaluation: 40.1,
        next: 30.9,
      });

      const { getGoldenAverages } = await import('../history-analytics.js');
      const result = getGoldenAverages(30);

      expect(result).toEqual({
        goal: 61,
        output: 55,
        limits: 51,
        data: 65,
        evaluation: 40,
        next: 31,
      });
    });

    it('should handle null values with zero fallback', async () => {
      mockGet.mockReturnValue({
        goal: null,
        output: null,
        limits: null,
        data: null,
        evaluation: null,
        next: null,
      });

      const { getGoldenAverages } = await import('../history-analytics.js');
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

    it('should accept custom days parameter', async () => {
      mockGet.mockReturnValue({
        goal: 50,
        output: 50,
        limits: 50,
        data: 50,
        evaluation: 50,
        next: 50,
      });

      const { getGoldenAverages } = await import('../history-analytics.js');
      getGoldenAverages(7);

      expect(mockGet).toHaveBeenCalledWith(7);
    });
  });

  describe('getWeeklyStats', () => {
    it('should return weekly statistics', async () => {
      mockAll.mockReturnValue([
        { week_start: '2024-01-01', avg_score: 60, count: 20, improvement: 5 },
        { week_start: '2024-01-08', avg_score: 65, count: 25, improvement: null },
      ]);

      const { getWeeklyStats } = await import('../history-analytics.js');
      const result = getWeeklyStats(4);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('weekStart', '2024-01-01');
      expect(result[0]).toHaveProperty('avgScore', 60);
      expect(result[0]).toHaveProperty('count', 20);
      expect(result[0]).toHaveProperty('improvement', 5);
    });

    it('should handle empty weeks', async () => {
      mockAll.mockReturnValue([]);

      const { getWeeklyStats } = await import('../history-analytics.js');
      const result = getWeeklyStats(4);

      expect(result).toEqual([]);
    });

    it('should handle null improvement for first week', async () => {
      mockAll.mockReturnValue([
        { week_start: '2024-01-01', avg_score: 60, count: 20, improvement: null },
      ]);

      const { getWeeklyStats } = await import('../history-analytics.js');
      const result = getWeeklyStats(4);

      expect(result[0].improvement).toBe(0);
    });
  });

  describe('getMonthlyStats', () => {
    it('should return monthly statistics with grade distribution', async () => {
      // Main query for months
      mockAll.mockReturnValueOnce([
        { month: '2024-01', avg_score: 60, count: 100 },
        { month: '2024-02', avg_score: 65, count: 120 },
      ]);

      // Grade distribution query
      mockAll.mockReturnValueOnce([
        { month: '2024-01', grade: 'A', count: 20 },
        { month: '2024-01', grade: 'B', count: 50 },
        { month: '2024-02', grade: 'A', count: 30 },
        { month: '2024-02', grade: 'B', count: 60 },
      ]);

      const { getMonthlyStats } = await import('../history-analytics.js');
      const result = getMonthlyStats(6);

      expect(result).toHaveLength(2);
      expect(result[0].month).toBe('2024-01');
      expect(result[0].avgScore).toBe(60);
      expect(result[0].count).toBe(100);
      expect(result[0].gradeDistribution).toEqual({ A: 20, B: 50 });
      expect(result[1].gradeDistribution).toEqual({ A: 30, B: 60 });
    });

    it('should handle empty grade distribution', async () => {
      mockAll.mockReturnValueOnce([
        { month: '2024-01', avg_score: 60, count: 100 },
      ]);
      mockAll.mockReturnValueOnce([]);

      const { getMonthlyStats } = await import('../history-analytics.js');
      const result = getMonthlyStats(6);

      expect(result[0].gradeDistribution).toEqual({});
    });
  });

  describe('getImprovementAnalysis', () => {
    it('should return comprehensive improvement analysis', async () => {
      // improvement query (first week vs last week)
      mockGet.mockReturnValueOnce({ improvement: 10 });

      // dimensions query
      mockGet.mockReturnValueOnce({
        goal: 70,
        output: 65,
        limits: 60,
        data: 75,
        evaluation: 50,
        next: 55,
      });

      // streak query
      mockGet.mockReturnValueOnce({ streak: 5 });

      // first A grade query
      mockGet.mockReturnValueOnce({ date: '2024-01-15', value: 85 });

      // highest score query
      mockGet.mockReturnValueOnce({ date: '2024-01-20', value: 90 });

      const { getImprovementAnalysis } = await import('../history-analytics.js');
      const result = getImprovementAnalysis();

      expect(result.overallImprovement).toBe(10);
      expect(result.bestDimension).toBe('data');
      expect(result.worstDimension).toBe('evaluation');
      expect(result.streak).toBe(5);
      expect(result.milestones).toHaveLength(2);
      expect(result.milestones[0].type).toBe('first_a_grade');
      expect(result.milestones[1].type).toBe('highest_score');
    });

    it('should handle null improvement', async () => {
      mockGet.mockReturnValueOnce({ improvement: null });
      mockGet.mockReturnValueOnce({
        goal: 50,
        output: 50,
        limits: 50,
        data: 50,
        evaluation: 50,
        next: 50,
      });
      mockGet.mockReturnValueOnce({ streak: 0 });
      mockGet.mockReturnValueOnce(undefined); // No A grade
      mockGet.mockReturnValueOnce({ date: null, value: null }); // No highest score

      const { getImprovementAnalysis } = await import('../history-analytics.js');
      const result = getImprovementAnalysis();

      expect(result.overallImprovement).toBe(0);
      expect(result.milestones).toEqual([]);
    });

    it('should handle negative improvement (declining trend)', async () => {
      mockGet.mockReturnValueOnce({ improvement: -5 });
      mockGet.mockReturnValueOnce({
        goal: 60,
        output: 60,
        limits: 60,
        data: 60,
        evaluation: 60,
        next: 60,
      });
      mockGet.mockReturnValueOnce({ streak: 2 });
      mockGet.mockReturnValueOnce(undefined);
      mockGet.mockReturnValueOnce({ date: null, value: null });

      const { getImprovementAnalysis } = await import('../history-analytics.js');
      const result = getImprovementAnalysis();

      expect(result.overallImprovement).toBe(-5);
      expect(result.streak).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return overall statistics with grade distribution and trend', async () => {
      // Total and average query
      mockGet.mockReturnValueOnce({
        total: 100,
        avg: 65,
      });

      // Grade distribution query
      mockAll.mockReturnValueOnce([
        { grade: 'A', count: 20 },
        { grade: 'B', count: 50 },
        { grade: 'C', count: 30 },
      ]);

      // Trend query (recent vs previous)
      mockGet.mockReturnValueOnce({
        recent: 70,
        previous: 60,
      });

      const { getStats } = await import('../history-analytics.js');
      const result = getStats();

      expect(result.totalAnalyses).toBe(100);
      expect(result.averageScore).toBe(65);
      expect(result.gradeDistribution).toEqual({ A: 20, B: 50, C: 30 });
      expect(result.recentTrend).toBe('improving'); // diff > 5
    });

    it('should handle zero total with empty distribution', async () => {
      mockGet.mockReturnValueOnce({
        total: 0,
        avg: null,
      });
      mockAll.mockReturnValueOnce([]);
      mockGet.mockReturnValueOnce({
        recent: null,
        previous: null,
      });

      const { getStats } = await import('../history-analytics.js');
      const result = getStats();

      expect(result.totalAnalyses).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.gradeDistribution).toEqual({});
      expect(result.recentTrend).toBe('stable');
    });

    it('should detect declining trend', async () => {
      mockGet.mockReturnValueOnce({ total: 100, avg: 65 });
      mockAll.mockReturnValueOnce([{ grade: 'B', count: 100 }]);
      mockGet.mockReturnValueOnce({
        recent: 50,
        previous: 60,
      });

      const { getStats } = await import('../history-analytics.js');
      const result = getStats();

      expect(result.recentTrend).toBe('declining'); // diff < -5
    });

    it('should detect stable trend for small changes', async () => {
      mockGet.mockReturnValueOnce({ total: 100, avg: 65 });
      mockAll.mockReturnValueOnce([{ grade: 'B', count: 100 }]);
      mockGet.mockReturnValueOnce({
        recent: 63,
        previous: 60,
      });

      const { getStats } = await import('../history-analytics.js');
      const result = getStats();

      expect(result.recentTrend).toBe('stable'); // diff = 3, not > 5
    });
  });

  describe('getIssuePatterns', () => {
    it('should return common issue patterns', async () => {
      mockAll.mockReturnValue([
        {
          issues_json: JSON.stringify([
            { severity: 'high', category: 'goal' },
            { severity: 'medium', category: 'output' },
          ]),
          analyzed_at: '2024-01-20',
          is_recent: 1,
        },
        {
          issues_json: JSON.stringify([
            { severity: 'high', category: 'goal' },
          ]),
          analyzed_at: '2024-01-15',
          is_recent: 0,
        },
      ]);

      const { getIssuePatterns } = await import('../history-analytics.js');
      const result = getIssuePatterns(30);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('severity');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('recentCount');
      expect(result[0]).toHaveProperty('trend');
      expect(result[0]).toHaveProperty('lastSeen');
    });
  });

  describe('getGoldenTrendByDimension', () => {
    it('should return dimension trends for all 6 GOLDEN dimensions', async () => {
      // Mock returns weekly data for each dimension query
      mockAll.mockReturnValue([
        { week_start: '2024-01-01', avg_score: 60, improvement: 5 },
        { week_start: '2024-01-08', avg_score: 65, improvement: null },
      ]);

      const { getGoldenTrendByDimension } = await import('../history-analytics.js');
      const result = getGoldenTrendByDimension(8);

      // Should return 6 dimension trends (goal, output, limits, data, evaluation, next)
      expect(result).toHaveLength(6);
      expect(result[0]).toHaveProperty('dimension');
      expect(result[0]).toHaveProperty('weeklyData');
      expect(result[0].weeklyData).toHaveLength(2);
      expect(result[0].weeklyData[0]).toEqual({
        weekStart: '2024-01-01',
        avgScore: 60,
        improvement: 5,
      });
    });
  });

  describe('getProjectGoldenAverages', () => {
    it('should return project-specific averages', async () => {
      mockGet.mockReturnValue({
        goal: 70,
        output: 65,
        limits: 60,
        data: 75,
        evaluation: 50,
        next: 40,
        count: 10, // Non-zero count to pass validation
      });

      const { getProjectGoldenAverages } = await import('../history-analytics.js');
      const result = getProjectGoldenAverages('/path/to/project');

      expect(result).toEqual({
        goal: 70,
        output: 65,
        limits: 60,
        data: 75,
        evaluation: 50,
        next: 40,
      });
    });

    it('should return null for non-existent project', async () => {
      mockGet.mockReturnValue({
        goal: null,
        output: null,
        limits: null,
        data: null,
        evaluation: null,
        next: null,
        count: 0,
      });

      const { getProjectGoldenAverages } = await import('../history-analytics.js');
      const result = getProjectGoldenAverages('/nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when count is undefined', async () => {
      mockGet.mockReturnValue({
        goal: null,
        output: null,
        limits: null,
        data: null,
        evaluation: null,
        next: null,
        count: undefined,
      });

      const { getProjectGoldenAverages } = await import('../history-analytics.js');
      const result = getProjectGoldenAverages('/project');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle database errors gracefully', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const { getScoreTrend } = await import('../history-analytics.js');

      expect(() => getScoreTrend(30)).toThrow('Database error');
    });

    it('should handle extreme day values', async () => {
      mockAll.mockReturnValue([]);

      const { getScoreTrend } = await import('../history-analytics.js');

      expect(() => getScoreTrend(0)).not.toThrow();
      expect(() => getScoreTrend(365)).not.toThrow();
      expect(() => getScoreTrend(9999)).not.toThrow();
    });
  });
});
