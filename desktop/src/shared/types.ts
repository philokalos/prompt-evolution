// Shared types between main and renderer processes

// Re-export types from parent's shared types
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
} from '../../../src/shared/types/index.js';

// Desktop-specific types (not in parent shared types)
export interface UserSettings {
  shortcut: string;
  windowBounds: { width: number; height: number };
  alwaysOnTop: boolean;
  showTrayIcon: boolean;
  autoLaunch: boolean;
}

// Re-export AnalysisResultWithContext from parent
export type { AnalysisResultWithContext } from '../../../src/shared/types/index.js';
