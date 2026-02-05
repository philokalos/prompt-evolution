/**
 * History Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { HistoryHandlerDeps } from '../history-handlers.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

describe('History Handlers', () => {
  let deps: HistoryHandlerDeps;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    deps = {
      getRecentAnalyses: vi.fn().mockReturnValue([
        { id: 1, score: 0.8, timestamp: '2024-01-01' },
        { id: 2, score: 0.7, timestamp: '2024-01-02' },
      ]),
      getScoreTrend: vi.fn().mockReturnValue([
        { date: '2024-01-01', score: 0.7 },
        { date: '2024-01-02', score: 0.8 },
      ]),
      getGoldenAverages: vi.fn().mockReturnValue({
        goal: 0.8,
        output: 0.7,
        limits: 0.6,
        data: 0.75,
        evaluation: 0.65,
        next: 0.5,
      }),
      getTopWeaknesses: vi.fn().mockReturnValue([
        { dimension: 'next', average: 0.5 },
        { dimension: 'limits', average: 0.6 },
      ]),
      getStats: vi.fn().mockReturnValue({
        totalAnalyses: 100,
        averageScore: 0.75,
        improvement: 0.1,
      }),
      getWeeklyStats: vi.fn().mockReturnValue([
        { week: '2024-W01', count: 10, avgScore: 0.7 },
        { week: '2024-W02', count: 15, avgScore: 0.8 },
      ]),
      getMonthlyStats: vi.fn().mockReturnValue([
        { month: '2024-01', count: 50, avgScore: 0.72 },
        { month: '2024-02', count: 60, avgScore: 0.78 },
      ]),
      getImprovementAnalysis: vi.fn().mockReturnValue({
        totalImprovement: 0.15,
        bestDimension: 'goal',
        worstDimension: 'next',
      }),
      getIssuePatterns: vi.fn().mockReturnValue([
        { pattern: 'missing_context', count: 25 },
        { pattern: 'vague_goal', count: 15 },
      ]),
      getGoldenTrendByDimension: vi.fn().mockReturnValue([
        { week: '2024-W01', goal: 0.7, output: 0.6 },
        { week: '2024-W02', goal: 0.8, output: 0.7 },
      ]),
      getConsecutiveImprovements: vi.fn().mockReturnValue([
        { startDate: '2024-01-01', streak: 5, improvement: 0.2 },
      ]),
      getCategoryPerformance: vi.fn().mockReturnValue([
        { category: 'code-generation', avgScore: 0.8, count: 30 },
        { category: 'debugging', avgScore: 0.7, count: 20 },
      ]),
      getPredictedScore: vi.fn().mockReturnValue({
        predicted: 0.82,
        confidence: 0.9,
        trend: 'improving',
      }),
    };

    const { registerHistoryHandlers } = await import('../history-handlers.js');
    registerHistoryHandlers(deps);
  });

  describe('get-history', () => {
    it('should call getRecentAnalyses with provided limit', async () => {
      const handler = mockIpcHandlers.get('get-history');
      await handler!(null, 50);

      expect(deps.getRecentAnalyses).toHaveBeenCalledWith(50);
    });

    it('should use default limit of 30 when not provided', async () => {
      const handler = mockIpcHandlers.get('get-history');
      await handler!(null);

      expect(deps.getRecentAnalyses).toHaveBeenCalledWith(30);
    });

    it('should return analysis history', async () => {
      const handler = mockIpcHandlers.get('get-history');
      const result = await handler!(null, 10);

      expect(result).toEqual([
        { id: 1, score: 0.8, timestamp: '2024-01-01' },
        { id: 2, score: 0.7, timestamp: '2024-01-02' },
      ]);
    });
  });

  describe('get-score-trend', () => {
    it('should call getScoreTrend with provided days', async () => {
      const handler = mockIpcHandlers.get('get-score-trend');
      await handler!(null, 60);

      expect(deps.getScoreTrend).toHaveBeenCalledWith(60);
    });

    it('should use default of 30 days when not provided', async () => {
      const handler = mockIpcHandlers.get('get-score-trend');
      await handler!(null);

      expect(deps.getScoreTrend).toHaveBeenCalledWith(30);
    });

    it('should return score trend data', async () => {
      const handler = mockIpcHandlers.get('get-score-trend');
      const result = await handler!(null, 7);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('score');
    });
  });

  describe('get-golden-averages', () => {
    it('should call getGoldenAverages with provided days', async () => {
      const handler = mockIpcHandlers.get('get-golden-averages');
      await handler!(null, 14);

      expect(deps.getGoldenAverages).toHaveBeenCalledWith(14);
    });

    it('should use default of 30 days when not provided', async () => {
      const handler = mockIpcHandlers.get('get-golden-averages');
      await handler!(null);

      expect(deps.getGoldenAverages).toHaveBeenCalledWith(30);
    });

    it('should return GOLDEN dimension averages', async () => {
      const handler = mockIpcHandlers.get('get-golden-averages');
      const result = await handler!(null, 30);

      expect(result).toHaveProperty('goal');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('limits');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('evaluation');
      expect(result).toHaveProperty('next');
    });
  });

  describe('get-top-weaknesses', () => {
    it('should call getTopWeaknesses with provided limit', async () => {
      const handler = mockIpcHandlers.get('get-top-weaknesses');
      await handler!(null, 5);

      expect(deps.getTopWeaknesses).toHaveBeenCalledWith(5);
    });

    it('should use default limit of 3 when not provided', async () => {
      const handler = mockIpcHandlers.get('get-top-weaknesses');
      await handler!(null);

      expect(deps.getTopWeaknesses).toHaveBeenCalledWith(3);
    });

    it('should return top weaknesses', async () => {
      const handler = mockIpcHandlers.get('get-top-weaknesses');
      const result = await handler!(null, 3);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('dimension');
      expect(result[0]).toHaveProperty('average');
    });
  });

  describe('get-stats', () => {
    it('should call getStats', async () => {
      const handler = mockIpcHandlers.get('get-stats');
      await handler!();

      expect(deps.getStats).toHaveBeenCalled();
    });

    it('should return overall stats', async () => {
      const handler = mockIpcHandlers.get('get-stats');
      const result = await handler!();

      expect(result).toEqual({
        totalAnalyses: 100,
        averageScore: 0.75,
        improvement: 0.1,
      });
    });
  });

  describe('get-weekly-stats', () => {
    it('should call getWeeklyStats with provided weeks', async () => {
      const handler = mockIpcHandlers.get('get-weekly-stats');
      await handler!(null, 8);

      expect(deps.getWeeklyStats).toHaveBeenCalledWith(8);
    });

    it('should use default of 4 weeks when not provided', async () => {
      const handler = mockIpcHandlers.get('get-weekly-stats');
      await handler!(null);

      expect(deps.getWeeklyStats).toHaveBeenCalledWith(4);
    });

    it('should return weekly statistics', async () => {
      const handler = mockIpcHandlers.get('get-weekly-stats');
      const result = await handler!(null, 4);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('week');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('avgScore');
    });
  });

  describe('get-monthly-stats', () => {
    it('should call getMonthlyStats with provided months', async () => {
      const handler = mockIpcHandlers.get('get-monthly-stats');
      await handler!(null, 12);

      expect(deps.getMonthlyStats).toHaveBeenCalledWith(12);
    });

    it('should use default of 6 months when not provided', async () => {
      const handler = mockIpcHandlers.get('get-monthly-stats');
      await handler!(null);

      expect(deps.getMonthlyStats).toHaveBeenCalledWith(6);
    });

    it('should return monthly statistics', async () => {
      const handler = mockIpcHandlers.get('get-monthly-stats');
      const result = await handler!(null, 6);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('month');
    });
  });

  describe('get-improvement-analysis', () => {
    it('should call getImprovementAnalysis', async () => {
      const handler = mockIpcHandlers.get('get-improvement-analysis');
      await handler!();

      expect(deps.getImprovementAnalysis).toHaveBeenCalled();
    });

    it('should return improvement analysis', async () => {
      const handler = mockIpcHandlers.get('get-improvement-analysis');
      const result = await handler!();

      expect(result).toEqual({
        totalImprovement: 0.15,
        bestDimension: 'goal',
        worstDimension: 'next',
      });
    });
  });

  describe('get-issue-patterns', () => {
    it('should call getIssuePatterns with provided days', async () => {
      const handler = mockIpcHandlers.get('get-issue-patterns');
      await handler!(null, 60);

      expect(deps.getIssuePatterns).toHaveBeenCalledWith(60);
    });

    it('should use default of 30 days when not provided', async () => {
      const handler = mockIpcHandlers.get('get-issue-patterns');
      await handler!(null);

      expect(deps.getIssuePatterns).toHaveBeenCalledWith(30);
    });

    it('should return issue patterns', async () => {
      const handler = mockIpcHandlers.get('get-issue-patterns');
      const result = await handler!(null, 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('pattern');
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('get-golden-trend-by-dimension', () => {
    it('should call getGoldenTrendByDimension with provided weeks', async () => {
      const handler = mockIpcHandlers.get('get-golden-trend-by-dimension');
      await handler!(null, 12);

      expect(deps.getGoldenTrendByDimension).toHaveBeenCalledWith(12);
    });

    it('should use default of 8 weeks when not provided', async () => {
      const handler = mockIpcHandlers.get('get-golden-trend-by-dimension');
      await handler!(null);

      expect(deps.getGoldenTrendByDimension).toHaveBeenCalledWith(8);
    });

    it('should return trend by dimension', async () => {
      const handler = mockIpcHandlers.get('get-golden-trend-by-dimension');
      const result = await handler!(null, 8);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('week');
      expect(result[0]).toHaveProperty('goal');
    });
  });

  describe('get-consecutive-improvements', () => {
    it('should call getConsecutiveImprovements with provided limit', async () => {
      const handler = mockIpcHandlers.get('get-consecutive-improvements');
      await handler!(null, 5);

      expect(deps.getConsecutiveImprovements).toHaveBeenCalledWith(5);
    });

    it('should use default limit of 10 when not provided', async () => {
      const handler = mockIpcHandlers.get('get-consecutive-improvements');
      await handler!(null);

      expect(deps.getConsecutiveImprovements).toHaveBeenCalledWith(10);
    });

    it('should return consecutive improvements', async () => {
      const handler = mockIpcHandlers.get('get-consecutive-improvements');
      const result = await handler!(null, 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('streak');
    });
  });

  describe('get-category-performance', () => {
    it('should call getCategoryPerformance', async () => {
      const handler = mockIpcHandlers.get('get-category-performance');
      await handler!();

      expect(deps.getCategoryPerformance).toHaveBeenCalled();
    });

    it('should return category performance', async () => {
      const handler = mockIpcHandlers.get('get-category-performance');
      const result = await handler!();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('avgScore');
    });
  });

  describe('get-predicted-score', () => {
    it('should call getPredictedScore with provided window days', async () => {
      const handler = mockIpcHandlers.get('get-predicted-score');
      await handler!(null, 14);

      expect(deps.getPredictedScore).toHaveBeenCalledWith(14);
    });

    it('should use default of 7 days when not provided', async () => {
      const handler = mockIpcHandlers.get('get-predicted-score');
      await handler!(null);

      expect(deps.getPredictedScore).toHaveBeenCalledWith(7);
    });

    it('should return predicted score', async () => {
      const handler = mockIpcHandlers.get('get-predicted-score');
      const result = await handler!(null, 7);

      expect(result).toEqual({
        predicted: 0.82,
        confidence: 0.9,
        trend: 'improving',
      });
    });
  });

  describe('IPC registration', () => {
    it('should register all history handlers', () => {
      expect(mockIpcHandlers.has('get-history')).toBe(true);
      expect(mockIpcHandlers.has('get-score-trend')).toBe(true);
      expect(mockIpcHandlers.has('get-golden-averages')).toBe(true);
      expect(mockIpcHandlers.has('get-top-weaknesses')).toBe(true);
      expect(mockIpcHandlers.has('get-stats')).toBe(true);
      expect(mockIpcHandlers.has('get-weekly-stats')).toBe(true);
      expect(mockIpcHandlers.has('get-monthly-stats')).toBe(true);
      expect(mockIpcHandlers.has('get-improvement-analysis')).toBe(true);
      expect(mockIpcHandlers.has('get-issue-patterns')).toBe(true);
      expect(mockIpcHandlers.has('get-golden-trend-by-dimension')).toBe(true);
      expect(mockIpcHandlers.has('get-consecutive-improvements')).toBe(true);
      expect(mockIpcHandlers.has('get-category-performance')).toBe(true);
      expect(mockIpcHandlers.has('get-predicted-score')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(13);
    });
  });
});
