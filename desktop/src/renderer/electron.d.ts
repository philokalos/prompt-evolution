/**
 * Global type declarations for Electron API
 * Exposed via contextBridge from preload
 *
 * This file re-exports types from the shared types directory.
 * The single source of truth is in src/shared/types/
 */

// Re-export all types from shared types
export type {
  // Electron API interface
  ElectronAPI,

  // IPC types
  ApplyPromptResult,
  ValidateKeyResult,
  UpdateCheckResult,
  UpdateDownloadResult,

  // Project types
  ProjectConfidence,
  DetectedProject,
  WindowInfo,
  CapturedContext,
  ProjectPatternAnalysis,
  HistoryRecommendation,
  PromptContextRecommendations,
  VariantType,
  ProjectSettings,
  CustomTemplate,
  PromptTemplate,
  TemplateFilterOptions,
  TemplateContext,

  // Analysis types
  ClipboardPayload,
  EmptyStateReason,
  EmptyStatePayload,
  PromptDetectedPayload,
  AIVariantResult,
  IssuePattern,
  GoldenDimensionTrend,
  ConsecutiveImprovement,
  CategoryPerformance,
  PredictedScore,
  Grade,
  GhostBarState,
  GhostBarSettings,

  // Settings types
  LanguageCode,
  LanguageResult,
  SetLanguageResult,
  LanguageChangedEvent,
  ProviderType,
  ProviderConfig,
  ShortcutFailedEvent,
} from '../shared/types/index.js';

// Global window augmentation is declared in shared/types/electron-api.ts
// This re-declaration ensures TypeScript picks it up in the renderer context
import type { ElectronAPI } from '../shared/types/electron-api.js';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
