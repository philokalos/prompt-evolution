/**
 * History IPC Handlers
 * Handles progress tracking, statistics, and analytics.
 */

import { ipcMain } from 'electron';

/**
 * Dependencies for history handlers
 */
export interface HistoryHandlerDeps {
  getRecentAnalyses: (limit: number) => unknown[];
  getScoreTrend: (days: number) => unknown[];
  getGoldenAverages: (days: number) => Record<string, number>;
  getTopWeaknesses: (limit: number) => unknown[];
  getStats: () => unknown;
  getWeeklyStats: (weeks: number) => unknown[];
  getMonthlyStats: (months: number) => unknown[];
  getImprovementAnalysis: () => unknown;
  getIssuePatterns: (days: number) => unknown[];
  getGoldenTrendByDimension: (weeks: number) => unknown[];
  getConsecutiveImprovements: (limit: number) => unknown[];
  getCategoryPerformance: () => unknown[];
  getPredictedScore: (windowDays: number) => unknown;
}

/**
 * Register history-related IPC handlers
 *
 * @param deps - Handler dependencies
 */
export function registerHistoryHandlers(deps: HistoryHandlerDeps): void {
  // Basic history handlers
  ipcMain.handle('get-history', async (_event, limit?: number) => {
    return deps.getRecentAnalyses(limit || 30);
  });

  ipcMain.handle('get-score-trend', async (_event, days?: number) => {
    return deps.getScoreTrend(days || 30);
  });

  ipcMain.handle('get-golden-averages', async (_event, days?: number) => {
    return deps.getGoldenAverages(days || 30);
  });

  ipcMain.handle('get-top-weaknesses', async (_event, limit?: number) => {
    return deps.getTopWeaknesses(limit || 3);
  });

  ipcMain.handle('get-stats', async () => {
    return deps.getStats();
  });

  ipcMain.handle('get-weekly-stats', async (_event, weeks?: number) => {
    return deps.getWeeklyStats(weeks || 4);
  });

  ipcMain.handle('get-monthly-stats', async (_event, months?: number) => {
    return deps.getMonthlyStats(months || 6);
  });

  ipcMain.handle('get-improvement-analysis', async () => {
    return deps.getImprovementAnalysis();
  });

  // Advanced analytics handlers (Phase 3)
  ipcMain.handle('get-issue-patterns', async (_event, days?: number) => {
    return deps.getIssuePatterns(days || 30);
  });

  ipcMain.handle('get-golden-trend-by-dimension', async (_event, weeks?: number) => {
    return deps.getGoldenTrendByDimension(weeks || 8);
  });

  ipcMain.handle('get-consecutive-improvements', async (_event, limit?: number) => {
    return deps.getConsecutiveImprovements(limit || 10);
  });

  ipcMain.handle('get-category-performance', async () => {
    return deps.getCategoryPerformance();
  });

  ipcMain.handle('get-predicted-score', async (_event, windowDays?: number) => {
    return deps.getPredictedScore(windowDays || 7);
  });
}
