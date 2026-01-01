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

  // Analysis
  analyzePrompt: (text: string) => Promise<AnalysisResultWithContext>;

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

  // Renderer ready signal
  signalReady: () => Promise<boolean>;

  // Event listeners
  onClipboardText: (callback: (text: string) => void) => void;
  removeClipboardListener: () => void;

  // Project change event listener (polling)
  onProjectChanged: (callback: (project: DetectedProject | null) => void) => void;
  removeProjectListener: () => void;
}

export interface DetectedProject {
  projectPath: string;
  ideName?: string;
  currentFile?: string;
  confidence: 'high' | 'medium' | 'low';
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
