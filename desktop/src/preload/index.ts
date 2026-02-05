import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload Script Types
 *
 * These are minimal runtime types used only in callback signatures.
 * The full type definitions are in shared/types/ and electron.d.ts.
 *
 * Note: Preload uses CommonJS with isolated rootDir, so we define
 * minimal types here to avoid cross-directory imports. This keeps
 * the preload thin and avoids complex tsconfig changes.
 */

/** Clipboard payload received from main process */
interface ClipboardPayload {
  text: string;
  capturedContext: unknown;
  isSourceAppBlocked: boolean;
}

/** Empty state payload when no text is captured */
interface EmptyStatePayload {
  reason: 'blocked-app' | 'no-selection' | 'empty-clipboard';
  appName: string | null;
  capturedContext: unknown;
}

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Clipboard operations
  getClipboard: (): Promise<string> => ipcRenderer.invoke('get-clipboard'),
  setClipboard: (text: string): Promise<boolean> => ipcRenderer.invoke('set-clipboard', text),

  // Settings
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: unknown): Promise<boolean> =>
    ipcRenderer.invoke('set-setting', key, value),

  // Window controls
  hideWindow: (): Promise<boolean> => ipcRenderer.invoke('hide-window'),
  minimizeWindow: (): Promise<boolean> => ipcRenderer.invoke('minimize-window'),

  // Apply improved prompt to source app
  applyImprovedPrompt: (text: string): Promise<{ success: boolean; fallback?: string; message?: string }> =>
    ipcRenderer.invoke('apply-improved-prompt', text),

  // Analysis
  analyzePrompt: (text: string): Promise<unknown> => ipcRenderer.invoke('analyze-prompt', text),

  // Phase 3.1: Async AI variant loading
  getAIVariant: (text: string): Promise<unknown> => ipcRenderer.invoke('get-ai-variant', text),

  // Multi-provider AI API support
  getProviders: (): Promise<unknown[]> => ipcRenderer.invoke('get-providers'),
  setProviders: (providers: unknown[]): Promise<boolean> =>
    ipcRenderer.invoke('set-providers', providers),
  validateProviderKey: (providerType: string, apiKey: string): Promise<{ valid: boolean; error: string | null }> =>
    ipcRenderer.invoke('validate-provider-key', providerType, apiKey),
  getPrimaryProvider: (): Promise<unknown> => ipcRenderer.invoke('get-primary-provider'),
  hasAnyProvider: (): Promise<boolean> => ipcRenderer.invoke('has-any-provider'),
  getAIVariantWithProviders: (text: string, providers: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('get-ai-variant-with-providers', text, providers),

  // History & Progress
  getHistory: (limit?: number): Promise<unknown[]> => ipcRenderer.invoke('get-history', limit),
  getScoreTrend: (days?: number): Promise<unknown[]> => ipcRenderer.invoke('get-score-trend', days),
  getGoldenAverages: (days?: number): Promise<Record<string, number>> =>
    ipcRenderer.invoke('get-golden-averages', days),
  getTopWeaknesses: (limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('get-top-weaknesses', limit),
  getStats: (): Promise<unknown> => ipcRenderer.invoke('get-stats'),
  getWeeklyStats: (weeks?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('get-weekly-stats', weeks),
  getMonthlyStats: (months?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('get-monthly-stats', months),
  getImprovementAnalysis: (): Promise<unknown> =>
    ipcRenderer.invoke('get-improvement-analysis'),

  // Session context
  getSessionContext: (): Promise<unknown> => ipcRenderer.invoke('get-session-context'),

  // Active project detection
  getCurrentProject: (): Promise<unknown> => ipcRenderer.invoke('get-current-project'),
  getAllOpenProjects: (): Promise<unknown[]> => ipcRenderer.invoke('get-all-open-projects'),
  selectProject: (projectPath: string | null): Promise<boolean> =>
    ipcRenderer.invoke('select-project', projectPath),

  // Phase 2: History-based recommendations
  getProjectPatterns: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('get-project-patterns', projectPath),
  getContextRecommendations: (category: string | undefined, projectPath: string | undefined): Promise<unknown> =>
    ipcRenderer.invoke('get-context-recommendations', category, projectPath),

  // Phase 3: Advanced analytics
  getIssuePatterns: (days?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('get-issue-patterns', days),
  getGoldenTrendByDimension: (weeks?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('get-golden-trend-by-dimension', weeks),
  getConsecutiveImprovements: (limit?: number): Promise<unknown[]> =>
    ipcRenderer.invoke('get-consecutive-improvements', limit),
  getCategoryPerformance: (): Promise<unknown[]> =>
    ipcRenderer.invoke('get-category-performance'),
  getPredictedScore: (windowDays?: number): Promise<unknown> =>
    ipcRenderer.invoke('get-predicted-score', windowDays),

  // Renderer ready signal (fixes IPC race condition)
  signalReady: (): Promise<boolean> => ipcRenderer.invoke('renderer-ready'),

  // Event listeners
  // NOTE: Remove existing listeners BEFORE adding new one to prevent duplicates
  // (React StrictMode calls useEffect twice, causing duplicate registrations)
  onClipboardText: (callback: (payload: ClipboardPayload) => void): void => {
    ipcRenderer.removeAllListeners('clipboard-text');
    ipcRenderer.on('clipboard-text', (_event, payload: ClipboardPayload) => callback(payload));
  },

  removeClipboardListener: (): void => {
    ipcRenderer.removeAllListeners('clipboard-text');
  },

  // Project change event listener
  onProjectChanged: (callback: (project: unknown) => void): void => {
    ipcRenderer.removeAllListeners('project-changed');
    ipcRenderer.on('project-changed', (_event, project) => callback(project));
  },

  removeProjectListener: (): void => {
    ipcRenderer.removeAllListeners('project-changed');
  },

  // Auto-updater
  checkForUpdates: (): Promise<{ available: boolean; version?: string; error?: string }> =>
    ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  getUpdateStatus: (): Promise<unknown> => ipcRenderer.invoke('get-update-status'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  onUpdateStatus: (callback: (status: unknown) => void): void => {
    ipcRenderer.on('update-status', (_event, status) => callback(status));
  },

  removeUpdateListener: (): void => {
    ipcRenderer.removeAllListeners('update-status');
  },

  // Navigation event (from tray menu)
  onNavigate: (callback: (view: string) => void): void => {
    ipcRenderer.removeAllListeners('navigate');
    ipcRenderer.on('navigate', (_event, view: string) => callback(view));
  },

  removeNavigateListener: (): void => {
    ipcRenderer.removeAllListeners('navigate');
  },

  // UI modal triggers (from menu)
  onShowOnboarding: (callback: () => void): void => {
    ipcRenderer.removeAllListeners('show-onboarding');
    ipcRenderer.on('show-onboarding', () => callback());
  },

  onShowAbout: (callback: () => void): void => {
    ipcRenderer.removeAllListeners('show-about');
    ipcRenderer.on('show-about', () => callback());
  },

  // Shortcut registration failure event
  onShortcutFailed: (callback: (data: { shortcut: string; message: string }) => void): void => {
    ipcRenderer.removeAllListeners('shortcut-failed');
    ipcRenderer.on('shortcut-failed', (_event, data) => callback(data));
  },

  removeShortcutFailedListener: (): void => {
    ipcRenderer.removeAllListeners('shortcut-failed');
  },

  // Prompt detected event (from clipboard watching)
  onPromptDetected: (callback: (data: { text: string; confidence: number }) => void): void => {
    ipcRenderer.removeAllListeners('prompt-detected');
    ipcRenderer.on('prompt-detected', (_event, data) => callback(data));
  },

  removePromptDetectedListener: (): void => {
    ipcRenderer.removeAllListeners('prompt-detected');
  },

  // Empty state event (no text captured on hotkey)
  onEmptyState: (callback: (payload: EmptyStatePayload) => void): void => {
    ipcRenderer.removeAllListeners('empty-state');
    ipcRenderer.on('empty-state', (_event, payload: EmptyStatePayload) => callback(payload));
  },

  removeEmptyStateListener: (): void => {
    ipcRenderer.removeAllListeners('empty-state');
  },

  // Open external URL
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),

  // Send one-way message to main process (for floating button)
  send: (channel: string, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args);
  },

  // Receive message from main process (for Ghost Bar)
  receive: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  // Invoke and wait for response
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // i18n Language support
  getLanguage: (): Promise<{ preference: string; resolved: string; systemLanguage: string }> =>
    ipcRenderer.invoke('get-language'),
  setLanguage: (language: string): Promise<{ success: boolean; resolvedLanguage?: string; error?: string }> =>
    ipcRenderer.invoke('set-language', language),
  onLanguageChanged: (callback: (data: { language: string; source: string }) => void): void => {
    ipcRenderer.removeAllListeners('language-changed');
    ipcRenderer.on('language-changed', (_event, data) => callback(data));
  },
  removeLanguageChangedListener: (): void => {
    ipcRenderer.removeAllListeners('language-changed');
  },
});

// Note: Type definitions are imported from shared/types/electron-api.ts
// which declares the global Window.electronAPI interface.
// The types here are used for runtime callbacks only.
