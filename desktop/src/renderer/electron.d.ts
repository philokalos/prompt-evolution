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

  // Phase 2: History-based recommendations
  getProjectPatterns: (projectPath: string) => Promise<ProjectPatternAnalysis>;
  getContextRecommendations: (category: string | undefined, projectPath: string | undefined) => Promise<PromptContextRecommendations>;

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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
