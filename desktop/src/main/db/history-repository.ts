/**
 * Prompt History Repository (barrel re-export)
 * PromptLint - Re-exports from focused modules for backward compatibility
 */

// Types
export type {
  PromptHistoryRecord,
  ProgressSnapshot,
  WeaknessStats,
  IssuePattern,
  GoldenDimensionTrend,
  ConsecutiveImprovement,
  CategoryPerformance,
} from './types.js';

// CRUD operations
export {
  saveAnalysis,
  getRecentAnalyses,
  getAnalysesByProject,
  getHighScoringPrompts,
  getSimilarPromptsByCategory,
  getTopWeaknesses,
} from './history-crud.js';

// Analytics functions
export {
  getScoreTrend,
  getGoldenAverages,
  getWeeklyStats,
  getMonthlyStats,
  getImprovementAnalysis,
  getStats,
  getIssuePatterns,
  getGoldenTrendByDimension,
  getConsecutiveImprovements,
  getCategoryPerformance,
  getPredictedScore,
  getProjectGoldenAverages,
  getProjectWeaknesses,
} from './history-analytics.js';
