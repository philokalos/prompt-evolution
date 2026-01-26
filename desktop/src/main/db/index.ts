/**
 * Desktop Database Module
 * PromptLint - Personal History Storage
 */

export { initializeDatabase, closeDatabase, databaseExists, DB_PATH } from './connection.js';
export {
  saveAnalysis,
  getRecentAnalyses,
  getScoreTrend,
  getGoldenAverages,
  getTopWeaknesses,
  getWeeklyStats,
  getMonthlyStats,
  getImprovementAnalysis,
  getStats,
  // Phase 3: Advanced analytics
  getIssuePatterns,
  getGoldenTrendByDimension,
  getConsecutiveImprovements,
  getCategoryPerformance,
  getPredictedScore,
  type PromptHistoryRecord,
  type ProgressSnapshot,
  type WeaknessStats,
  type IssuePattern,
  type GoldenDimensionTrend,
  type ConsecutiveImprovement,
  type CategoryPerformance,
} from './history-repository.js';
