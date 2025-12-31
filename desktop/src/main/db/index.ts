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
  getStats,
  type PromptHistoryRecord,
  type ProgressSnapshot,
  type WeaknessStats,
} from './history-repository.js';
