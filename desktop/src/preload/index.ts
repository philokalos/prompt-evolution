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

  // Analysis (to be implemented)
  analyzePrompt: (text: string): Promise<unknown> => ipcRenderer.invoke('analyze-prompt', text),

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
      onClipboardText: (callback: (text: string) => void) => void;
      removeClipboardListener: () => void;
    };
  }
}
