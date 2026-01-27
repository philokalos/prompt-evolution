/**
 * Global type declarations for Electron API
 * Exposed via contextBridge from preload
 */

import type { ActiveSessionContext, AnalysisResultWithContext } from '../shared/types';

export interface ElectronAPI {
  // Clipboard operations
  getClipboard: () => Promise<string>;
  setClipboard: (text: string) => Promise<boolean>;

  // Settings
  getSettings: () => Promise<Record<string, unknown>>;
  setSetting: (key: string, value: unknown) => Promise<boolean>;

  // Window controls
  hideWindow: () => Promise<boolean>;
  minimizeWindow: () => Promise<boolean>;

  // Apply improved prompt to source app
  applyImprovedPrompt: (text: string) => Promise<{ success: boolean; fallback?: string; message?: string }>;

  // Analysis
  analyzePrompt: (text: string) => Promise<AnalysisResultWithContext>;

  // Phase 3.1: Async AI variant loading
  getAIVariant: (text: string) => Promise<AIVariantResult>;

  // Multi-provider AI API support
  getProviders: () => Promise<ProviderConfig[]>;
  setProviders: (providers: ProviderConfig[]) => Promise<boolean>;
  validateProviderKey: (providerType: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  getPrimaryProvider: () => Promise<ProviderConfig | null>;
  hasAnyProvider: () => Promise<boolean>;
  getAIVariantWithProviders: (text: string, providers: ProviderConfig[]) => Promise<AIVariantResult>;

  // History & Progress
  getHistory: (limit?: number) => Promise<unknown[]>;
  getScoreTrend: (days?: number) => Promise<unknown[]>;
  getGoldenAverages: (days?: number) => Promise<Record<string, number>>;
  getTopWeaknesses: (limit?: number) => Promise<unknown[]>;
  getStats: () => Promise<unknown>;
  getWeeklyStats: (weeks?: number) => Promise<unknown[]>;
  getMonthlyStats: (months?: number) => Promise<unknown[]>;
  getImprovementAnalysis: () => Promise<unknown>;

  // Session context
  getSessionContext: () => Promise<ActiveSessionContext | null>;

  // Active project detection (polling-based)
  getCurrentProject: () => Promise<DetectedProject | null>;
  getAllOpenProjects: () => Promise<DetectedProject[]>;
  selectProject: (projectPath: string | null) => Promise<boolean>;

  // Phase 2: History-based recommendations
  getProjectPatterns: (projectPath: string) => Promise<ProjectPatternAnalysis>;
  getContextRecommendations: (category: string | undefined, projectPath: string | undefined) => Promise<PromptContextRecommendations>;

  // Phase 3: Advanced analytics
  getIssuePatterns: (days?: number) => Promise<IssuePattern[]>;
  getGoldenTrendByDimension: (weeks?: number) => Promise<GoldenDimensionTrend[]>;
  getConsecutiveImprovements: (limit?: number) => Promise<ConsecutiveImprovement[]>;
  getCategoryPerformance: () => Promise<CategoryPerformance[]>;
  getPredictedScore: (windowDays?: number) => Promise<PredictedScore>;

  // Phase 4: Project settings and templates
  getProjectSettings: (projectPath: string) => Promise<ProjectSettings | null>;
  saveProjectSettings: (settings: ProjectSettings) => Promise<{ success: boolean }>;
  deleteProjectSettings: (projectPath: string) => Promise<{ success: boolean }>;
  getTemplates: (options?: TemplateFilterOptions) => Promise<PromptTemplate[]>;
  getTemplate: (idOrName: number | string) => Promise<PromptTemplate | null>;
  saveTemplate: (template: PromptTemplate) => Promise<{ success: boolean; id: number }>;
  deleteTemplate: (id: number) => Promise<{ success: boolean }>;
  getRecommendedTemplate: (context: TemplateContext) => Promise<PromptTemplate | null>;
  incrementTemplateUsage: (templateId: number) => Promise<{ success: boolean }>;

  // Renderer ready signal
  signalReady: () => Promise<boolean>;

  // Event listeners
  onClipboardText: (callback: (payload: ClipboardPayload) => void) => void;
  removeClipboardListener: () => void;

  // Project change event listener (polling)
  onProjectChanged: (callback: (project: DetectedProject | null) => void) => void;
  removeProjectListener: () => void;

  // Navigation (from tray menu)
  onNavigate: (callback: (view: string) => void) => void;
  removeNavigateListener: () => void;

  // Shortcut registration failure
  onShortcutFailed: (callback: (data: { shortcut: string; message: string }) => void) => void;
  removeShortcutFailedListener: () => void;

  // Prompt detected (from clipboard watching)
  onPromptDetected: (callback: (data: { text: string; confidence: number }) => void) => void;
  removePromptDetectedListener: () => void;

  // Empty state (no text captured)
  onEmptyState: (callback: (payload: EmptyStatePayload) => void) => void;
  removeEmptyStateListener: () => void;

  // External links
  openExternal: (url: string) => Promise<void>;

  // App version
  getAppVersion: () => Promise<string>;

  // i18n Language support
  getLanguage: () => Promise<LanguageResult>;
  setLanguage: (lang: LanguageCode) => Promise<SetLanguageResult>;
  onLanguageChanged: (callback: (data: LanguageChangedEvent) => void) => void;
  removeLanguageChangedListener: () => void;

  // UI modal triggers (optional, triggered via webContents.send)
  onShowOnboarding?: (callback: () => void) => void;
  onShowAbout?: (callback: () => void) => void;
}

// i18n Language types
export type LanguageCode = 'auto' | 'en' | 'ko';

export interface LanguageResult {
  preference: string;
  resolved: string;
  systemLanguage: string;
}

export interface SetLanguageResult {
  success: boolean;
  resolvedLanguage?: string;
  error?: string;
}

export interface LanguageChangedEvent {
  language: string;
  source: string;
}

export interface DetectedProject {
  projectPath: string;
  projectName: string;
  ideName: string;
  currentFile?: string;
  confidence: 'high' | 'medium' | 'low';
  isManual?: boolean;
}

/**
 * Captured context at hotkey time
 * Used to ensure correct project detection even if user switches windows
 */
export interface CapturedContext {
  windowInfo: {
    appName: string;
    windowTitle: string;
    isIDE: boolean;
  } | null;
  project: DetectedProject | null;
  timestamp: string; // ISO string (Date serialized via IPC)
}

/**
 * Payload sent from main process with clipboard text and captured context
 */
export interface ClipboardPayload {
  text: string;
  capturedContext: CapturedContext | null;
  isSourceAppBlocked: boolean; // True if source app doesn't support AppleScript paste
}

/**
 * Empty state reason when no text is captured
 * Used to show contextual guidance to user
 */
export type EmptyStateReason = 'blocked-app' | 'no-selection' | 'empty-clipboard';

/**
 * Payload sent when hotkey is pressed but no text is captured
 */
export interface EmptyStatePayload {
  reason: EmptyStateReason;
  appName: string | null;
  capturedContext: CapturedContext | null;
}

// Phase 3.1: Async AI variant result type
export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai';

export interface AIVariantResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean;
  isLoading?: boolean;
}

// Phase 2: History-based recommendation types
export interface HistoryRecommendation {
  type: 'weakness' | 'improvement' | 'reference' | 'pattern';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  dimension?: string;
  examplePrompt?: string;
  improvement?: number;
}

export interface ProjectPatternAnalysis {
  projectPath: string;
  totalAnalyses: number;
  averageScore: number;
  goldenAverages: Record<string, number> | null;
  weaknesses: Array<{
    dimension: string;
    averageScore: number;
    belowThresholdCount: number;
  }>;
  recommendations: HistoryRecommendation[];
  highScoringExamples: unknown[];
}

export interface PromptContextRecommendations {
  basedOnProject: HistoryRecommendation[];
  basedOnCategory: HistoryRecommendation[];
  referencePrompts: unknown[];
}

// Phase 3: Advanced analytics types
export interface IssuePattern {
  category: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  recentCount: number;
  trend: 'improving' | 'stable' | 'worsening';
  lastSeen: Date;
}

export interface GoldenDimensionTrend {
  dimension: string;
  weeklyData: Array<{
    weekStart: string;
    avgScore: number;
    improvement: number;
  }>;
}

export interface ConsecutiveImprovement {
  startDate: string;
  endDate: string;
  improvementCount: number;
  scoreIncrease: number;
  averageGain: number;
}

export interface CategoryPerformance {
  category: string;
  count: number;
  averageScore: number;
  bestScore: number;
  trend: 'improving' | 'stable' | 'declining';
  commonWeakness?: string;
}

export interface PredictedScore {
  predictedScore: number;
  confidence: 'high' | 'medium' | 'low';
  trend: number;
}

// Phase 4: Project settings and templates types
export interface ProjectSettings {
  id?: number;
  projectPath: string;
  projectName?: string;
  ideType?: string;
  preferredVariant?: 'conservative' | 'balanced' | 'comprehensive' | 'ai';
  customConstraints?: string;
  customTemplates?: CustomTemplate[];
  autoInjectContext?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomTemplate {
  name: string;
  trigger: string;
  template: string;
}

export interface PromptTemplate {
  id?: number;
  name: string;
  ideType?: string;
  category?: string;
  templateText: string;
  description?: string;
  isActive?: boolean;
  usageCount?: number;
  createdAt?: Date;
}

export interface TemplateFilterOptions {
  ideType?: string;
  category?: string;
  activeOnly?: boolean;
}

export interface TemplateContext {
  ideType?: string;
  category?: string;
  projectPath?: string;
}

// Multi-provider configuration
export interface ProviderConfig {
  provider: 'claude' | 'openai' | 'gemini';
  apiKey: string;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number;
  displayName?: string;
  modelId?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
