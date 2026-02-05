/**
 * Electron API Interface
 * Type definitions for window.electronAPI exposed via contextBridge.
 * This is the single source of truth for the preload API contract.
 */

import type { ActiveSessionContext, AnalysisResultWithContext } from '../../../../src/shared/types/index.js';
import type {
  ClipboardPayload,
  EmptyStatePayload,
  AIVariantResult,
  IssuePattern,
  GoldenDimensionTrend,
  ConsecutiveImprovement,
  CategoryPerformance,
  PredictedScore,
  PromptDetectedPayload,
} from './analysis.js';
import type {
  DetectedProject,
  ProjectPatternAnalysis,
  PromptContextRecommendations,
  ProjectSettings,
  PromptTemplate,
  TemplateFilterOptions,
  TemplateContext,
} from './project.js';
import type {
  LanguageCode,
  LanguageResult,
  SetLanguageResult,
  LanguageChangedEvent,
  ProviderConfig,
  ShortcutFailedEvent,
} from './settings.js';
import type { ApplyPromptResult, ValidateKeyResult, UpdateCheckResult, UpdateDownloadResult } from './ipc.js';

/**
 * Complete Electron API interface exposed to renderer via preload
 */
export interface ElectronAPI {
  // =========================================================================
  // Clipboard Operations
  // =========================================================================
  getClipboard: () => Promise<string>;
  setClipboard: (text: string) => Promise<boolean>;

  // =========================================================================
  // Settings
  // =========================================================================
  getSettings: () => Promise<Record<string, unknown>>;
  setSetting: (key: string, value: unknown) => Promise<boolean>;

  // =========================================================================
  // Window Controls
  // =========================================================================
  hideWindow: () => Promise<boolean>;
  minimizeWindow: () => Promise<boolean>;
  applyImprovedPrompt: (text: string) => Promise<ApplyPromptResult>;

  // =========================================================================
  // Analysis
  // =========================================================================
  analyzePrompt: (text: string) => Promise<AnalysisResultWithContext>;
  getAIVariant: (text: string) => Promise<AIVariantResult>;

  // =========================================================================
  // Multi-provider AI API
  // =========================================================================
  getProviders: () => Promise<ProviderConfig[]>;
  setProviders: (providers: ProviderConfig[]) => Promise<boolean>;
  validateProviderKey: (providerType: string, apiKey: string) => Promise<ValidateKeyResult>;
  getPrimaryProvider: () => Promise<ProviderConfig | null>;
  hasAnyProvider: () => Promise<boolean>;
  getAIVariantWithProviders: (text: string, providers: ProviderConfig[]) => Promise<AIVariantResult>;

  // =========================================================================
  // History & Progress
  // =========================================================================
  getHistory: (limit?: number) => Promise<unknown[]>;
  getScoreTrend: (days?: number) => Promise<unknown[]>;
  getGoldenAverages: (days?: number) => Promise<Record<string, number>>;
  getTopWeaknesses: (limit?: number) => Promise<unknown[]>;
  getStats: () => Promise<unknown>;
  getWeeklyStats: (weeks?: number) => Promise<unknown[]>;
  getMonthlyStats: (months?: number) => Promise<unknown[]>;
  getImprovementAnalysis: () => Promise<unknown>;

  // =========================================================================
  // Session Context
  // =========================================================================
  getSessionContext: () => Promise<ActiveSessionContext | null>;

  // =========================================================================
  // Active Project Detection (polling-based)
  // =========================================================================
  getCurrentProject: () => Promise<DetectedProject | null>;
  getAllOpenProjects: () => Promise<DetectedProject[]>;
  selectProject: (projectPath: string | null) => Promise<boolean>;

  // =========================================================================
  // History-based Recommendations
  // =========================================================================
  getProjectPatterns: (projectPath: string) => Promise<ProjectPatternAnalysis>;
  getContextRecommendations: (
    category: string | undefined,
    projectPath: string | undefined
  ) => Promise<PromptContextRecommendations>;

  // =========================================================================
  // Advanced Analytics
  // =========================================================================
  getIssuePatterns: (days?: number) => Promise<IssuePattern[]>;
  getGoldenTrendByDimension: (weeks?: number) => Promise<GoldenDimensionTrend[]>;
  getConsecutiveImprovements: (limit?: number) => Promise<ConsecutiveImprovement[]>;
  getCategoryPerformance: () => Promise<CategoryPerformance[]>;
  getPredictedScore: (windowDays?: number) => Promise<PredictedScore>;

  // =========================================================================
  // Project Settings and Templates
  // =========================================================================
  getProjectSettings: (projectPath: string) => Promise<ProjectSettings | null>;
  saveProjectSettings: (settings: ProjectSettings) => Promise<{ success: boolean }>;
  deleteProjectSettings: (projectPath: string) => Promise<{ success: boolean }>;
  getTemplates: (options?: TemplateFilterOptions) => Promise<PromptTemplate[]>;
  getTemplate: (idOrName: number | string) => Promise<PromptTemplate | null>;
  saveTemplate: (template: PromptTemplate) => Promise<{ success: boolean; id: number }>;
  deleteTemplate: (id: number) => Promise<{ success: boolean }>;
  getRecommendedTemplate: (context: TemplateContext) => Promise<PromptTemplate | null>;
  incrementTemplateUsage: (templateId: number) => Promise<{ success: boolean }>;

  // =========================================================================
  // Renderer Ready Signal
  // =========================================================================
  signalReady: () => Promise<boolean>;

  // =========================================================================
  // Event Listeners - Clipboard/Text
  // =========================================================================
  onClipboardText: (callback: (payload: ClipboardPayload) => void) => void;
  removeClipboardListener: () => void;
  onPromptDetected: (callback: (data: PromptDetectedPayload) => void) => void;
  removePromptDetectedListener: () => void;
  onEmptyState: (callback: (payload: EmptyStatePayload) => void) => void;
  removeEmptyStateListener: () => void;

  // =========================================================================
  // Event Listeners - Project
  // =========================================================================
  onProjectChanged: (callback: (project: DetectedProject | null) => void) => void;
  removeProjectListener: () => void;

  // =========================================================================
  // Event Listeners - Navigation & UI
  // =========================================================================
  onNavigate: (callback: (view: string) => void) => void;
  removeNavigateListener: () => void;
  onShowOnboarding?: (callback: () => void) => void;
  onShowAbout?: (callback: () => void) => void;

  // =========================================================================
  // Event Listeners - Status
  // =========================================================================
  onShortcutFailed: (callback: (data: ShortcutFailedEvent) => void) => void;
  removeShortcutFailedListener: () => void;
  onUpdateStatus: (callback: (status: unknown) => void) => void;
  removeUpdateListener: () => void;

  // =========================================================================
  // Auto-updater
  // =========================================================================
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadUpdate: () => Promise<UpdateDownloadResult>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<unknown>;
  getAppVersion: () => Promise<string>;

  // =========================================================================
  // External Links
  // =========================================================================
  openExternal: (url: string) => Promise<void>;

  // =========================================================================
  // Generic IPC (for extensibility)
  // =========================================================================
  send: (channel: string, ...args: unknown[]) => void;
  receive?: (channel: string, callback: (...args: unknown[]) => void) => void;
  invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>;

  // =========================================================================
  // i18n Language Support
  // =========================================================================
  getLanguage: () => Promise<LanguageResult>;
  setLanguage: (lang: LanguageCode) => Promise<SetLanguageResult>;
  onLanguageChanged: (callback: (data: LanguageChangedEvent) => void) => void;
  removeLanguageChangedListener: () => void;
}

/**
 * Global window augmentation for TypeScript
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
