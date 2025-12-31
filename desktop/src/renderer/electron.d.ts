/**
 * Global type declarations for Electron API
 * Exposed via contextBridge from preload
 */

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

  // Analysis
  analyzePrompt: (text: string) => Promise<unknown>;

  // History & Progress
  getHistory: (limit?: number) => Promise<unknown[]>;
  getScoreTrend: (days?: number) => Promise<unknown[]>;
  getGoldenAverages: (days?: number) => Promise<Record<string, number>>;
  getTopWeaknesses: (limit?: number) => Promise<unknown[]>;
  getStats: () => Promise<unknown>;
  getWeeklyStats: (weeks?: number) => Promise<unknown[]>;
  getMonthlyStats: (months?: number) => Promise<unknown[]>;
  getImprovementAnalysis: () => Promise<unknown>;

  // Event listeners
  onClipboardText: (callback: (text: string) => void) => void;
  removeClipboardListener: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
