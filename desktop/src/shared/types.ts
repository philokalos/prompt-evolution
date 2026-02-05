/**
 * Shared Types (Legacy Entry Point)
 *
 * This file re-exports from the new types/ directory for backward compatibility.
 * New code should import directly from './types/index.js' or specific type modules.
 *
 * @deprecated Import from './types/index.js' instead
 */

// Re-export everything from the new types directory
export * from './types/index.js';

// Re-export parent types (backward compatibility)
export type {
  PromptIntent,
  TaskCategory,
  PromptClassification,
  Issue,
  AnalysisResult,
  GoldenScores,
  SessionContext,
  ActiveSessionContext,
  RewriteResult,
  HistoryRecommendation,
  PromptHistory,
  PersonalStats,
  ProgressPoint,
  AnalysisResultWithContext,
} from '../../../src/shared/types/index.js';
