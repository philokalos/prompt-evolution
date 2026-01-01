import { contextBridge, ipcRenderer } from 'electron';

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

  // Event listeners
  onClipboardText: (callback: (text: string) => void): void => {
    ipcRenderer.on('clipboard-text', (_event, text) => callback(text));
  },

  removeClipboardListener: (): void => {
    ipcRenderer.removeAllListeners('clipboard-text');
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getClipboard: () => Promise<string>;
      setClipboard: (text: string) => Promise<boolean>;
      getSettings: () => Promise<Record<string, unknown>>;
      setSetting: (key: string, value: unknown) => Promise<boolean>;
      hideWindow: () => Promise<boolean>;
      minimizeWindow: () => Promise<boolean>;
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
      onClipboardText: (callback: (text: string) => void) => void;
      removeClipboardListener: () => void;
    };
  }
}
