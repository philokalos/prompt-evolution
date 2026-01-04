import { contextBridge, ipcRenderer } from 'electron';

/**
 * Captured context at hotkey time (mirrors main process type)
 * Used to ensure correct project detection even if user switches windows
 */
interface CapturedContext {
  windowInfo: {
    appName: string;
    windowTitle: string;
    isIDE: boolean;
  } | null;
  project: {
    projectPath: string;
    projectName: string;
    source: string;
    confidence: number;
    currentFile?: string;
  } | null;
  timestamp: string; // ISO string (Date serialized via IPC)
}

/**
 * Payload sent from main process with clipboard text and captured context
 */
interface ClipboardPayload {
  text: string;
  capturedContext: CapturedContext | null;
  isSourceAppBlocked: boolean; // True if source app doesn't support AppleScript paste
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

  // Phase 2: History-based recommendations
  getProjectPatterns: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('get-project-patterns', projectPath),
  getContextRecommendations: (category: string | undefined, projectPath: string | undefined): Promise<unknown> =>
    ipcRenderer.invoke('get-context-recommendations', category, projectPath),

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

  // Open external URL
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
});

// Type definitions for TypeScript
declare global {
  /**
   * Captured context at hotkey time
   */
  interface CapturedContext {
    windowInfo: {
      appName: string;
      windowTitle: string;
      isIDE: boolean;
    } | null;
    project: {
      projectPath: string;
      projectName: string;
      source: string;
      confidence: number;
      currentFile?: string;
    } | null;
    timestamp: string;
  }

  /**
   * Payload sent from main process with clipboard text and captured context
   */
  interface ClipboardPayload {
    text: string;
    capturedContext: CapturedContext | null;
    isSourceAppBlocked: boolean;
  }

  interface Window {
    electronAPI: {
      getClipboard: () => Promise<string>;
      setClipboard: (text: string) => Promise<boolean>;
      getSettings: () => Promise<Record<string, unknown>>;
      setSetting: (key: string, value: unknown) => Promise<boolean>;
      hideWindow: () => Promise<boolean>;
      minimizeWindow: () => Promise<boolean>;
      applyImprovedPrompt: (text: string) => Promise<{ success: boolean; fallback?: string; message?: string }>;
      analyzePrompt: (text: string) => Promise<unknown>;
      getHistory: (limit?: number) => Promise<unknown[]>;
      getScoreTrend: (days?: number) => Promise<unknown[]>;
      getGoldenAverages: (days?: number) => Promise<Record<string, number>>;
      getTopWeaknesses: (limit?: number) => Promise<unknown[]>;
      getStats: () => Promise<unknown>;
      getWeeklyStats: (weeks?: number) => Promise<unknown[]>;
      getMonthlyStats: (months?: number) => Promise<unknown[]>;
      getImprovementAnalysis: () => Promise<unknown>;
      getSessionContext: () => Promise<unknown>;
      getCurrentProject: () => Promise<unknown>;
      getProjectPatterns: (projectPath: string) => Promise<unknown>;
      getContextRecommendations: (category: string | undefined, projectPath: string | undefined) => Promise<unknown>;
      signalReady: () => Promise<boolean>;
      onClipboardText: (callback: (payload: ClipboardPayload) => void) => void;
      removeClipboardListener: () => void;
      onProjectChanged: (callback: (project: unknown) => void) => void;
      removeProjectListener: () => void;
      // Auto-updater
      checkForUpdates: () => Promise<{ available: boolean; version?: string; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => Promise<void>;
      getUpdateStatus: () => Promise<unknown>;
      getAppVersion: () => Promise<string>;
      onUpdateStatus: (callback: (status: unknown) => void) => void;
      removeUpdateListener: () => void;
      // Navigation
      onNavigate: (callback: (view: string) => void) => void;
      removeNavigateListener: () => void;
      // Shortcut registration failure
      onShortcutFailed: (callback: (data: { shortcut: string; message: string }) => void) => void;
      removeShortcutFailedListener: () => void;
      // Prompt detection
      onPromptDetected: (callback: (data: { text: string; confidence: number }) => void) => void;
      removePromptDetectedListener: () => void;
      // External links
      openExternal: (url: string) => Promise<void>;
    };
  }
}
