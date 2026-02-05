/**
 * Electron API Interface
 * Type definitions for window.electronAPI exposed via contextBridge.
 * This is the single source of truth for the preload API contract.
 */
import type { ActiveSessionContext, AnalysisResultWithContext } from '../../../../src/shared/types/index.js';
import type { ClipboardPayload, EmptyStatePayload, AIVariantResult, IssuePattern, GoldenDimensionTrend, ConsecutiveImprovement, CategoryPerformance, PredictedScore, PromptDetectedPayload } from './analysis.js';
import type { DetectedProject, ProjectPatternAnalysis, PromptContextRecommendations, ProjectSettings, PromptTemplate, TemplateFilterOptions, TemplateContext } from './project.js';
import type { LanguageCode, LanguageResult, SetLanguageResult, LanguageChangedEvent, ProviderConfig, ShortcutFailedEvent } from './settings.js';
import type { ApplyPromptResult, ValidateKeyResult, UpdateCheckResult, UpdateDownloadResult } from './ipc.js';
/**
 * Complete Electron API interface exposed to renderer via preload
 */
export interface ElectronAPI {
    getClipboard: () => Promise<string>;
    setClipboard: (text: string) => Promise<boolean>;
    getSettings: () => Promise<Record<string, unknown>>;
    setSetting: (key: string, value: unknown) => Promise<boolean>;
    hideWindow: () => Promise<boolean>;
    minimizeWindow: () => Promise<boolean>;
    applyImprovedPrompt: (text: string) => Promise<ApplyPromptResult>;
    analyzePrompt: (text: string) => Promise<AnalysisResultWithContext>;
    getAIVariant: (text: string) => Promise<AIVariantResult>;
    getProviders: () => Promise<ProviderConfig[]>;
    setProviders: (providers: ProviderConfig[]) => Promise<boolean>;
    validateProviderKey: (providerType: string, apiKey: string) => Promise<ValidateKeyResult>;
    getPrimaryProvider: () => Promise<ProviderConfig | null>;
    hasAnyProvider: () => Promise<boolean>;
    getAIVariantWithProviders: (text: string, providers: ProviderConfig[]) => Promise<AIVariantResult>;
    getHistory: (limit?: number) => Promise<unknown[]>;
    getScoreTrend: (days?: number) => Promise<unknown[]>;
    getGoldenAverages: (days?: number) => Promise<Record<string, number>>;
    getTopWeaknesses: (limit?: number) => Promise<unknown[]>;
    getStats: () => Promise<unknown>;
    getWeeklyStats: (weeks?: number) => Promise<unknown[]>;
    getMonthlyStats: (months?: number) => Promise<unknown[]>;
    getImprovementAnalysis: () => Promise<unknown>;
    getSessionContext: () => Promise<ActiveSessionContext | null>;
    getCurrentProject: () => Promise<DetectedProject | null>;
    getAllOpenProjects: () => Promise<DetectedProject[]>;
    selectProject: (projectPath: string | null) => Promise<boolean>;
    getProjectPatterns: (projectPath: string) => Promise<ProjectPatternAnalysis>;
    getContextRecommendations: (category: string | undefined, projectPath: string | undefined) => Promise<PromptContextRecommendations>;
    getIssuePatterns: (days?: number) => Promise<IssuePattern[]>;
    getGoldenTrendByDimension: (weeks?: number) => Promise<GoldenDimensionTrend[]>;
    getConsecutiveImprovements: (limit?: number) => Promise<ConsecutiveImprovement[]>;
    getCategoryPerformance: () => Promise<CategoryPerformance[]>;
    getPredictedScore: (windowDays?: number) => Promise<PredictedScore>;
    getProjectSettings: (projectPath: string) => Promise<ProjectSettings | null>;
    saveProjectSettings: (settings: ProjectSettings) => Promise<{
        success: boolean;
    }>;
    deleteProjectSettings: (projectPath: string) => Promise<{
        success: boolean;
    }>;
    getTemplates: (options?: TemplateFilterOptions) => Promise<PromptTemplate[]>;
    getTemplate: (idOrName: number | string) => Promise<PromptTemplate | null>;
    saveTemplate: (template: PromptTemplate) => Promise<{
        success: boolean;
        id: number;
    }>;
    deleteTemplate: (id: number) => Promise<{
        success: boolean;
    }>;
    getRecommendedTemplate: (context: TemplateContext) => Promise<PromptTemplate | null>;
    incrementTemplateUsage: (templateId: number) => Promise<{
        success: boolean;
    }>;
    signalReady: () => Promise<boolean>;
    onClipboardText: (callback: (payload: ClipboardPayload) => void) => void;
    removeClipboardListener: () => void;
    onPromptDetected: (callback: (data: PromptDetectedPayload) => void) => void;
    removePromptDetectedListener: () => void;
    onEmptyState: (callback: (payload: EmptyStatePayload) => void) => void;
    removeEmptyStateListener: () => void;
    onProjectChanged: (callback: (project: DetectedProject | null) => void) => void;
    removeProjectListener: () => void;
    onNavigate: (callback: (view: string) => void) => void;
    removeNavigateListener: () => void;
    onShowOnboarding?: (callback: () => void) => void;
    onShowAbout?: (callback: () => void) => void;
    onShortcutFailed: (callback: (data: ShortcutFailedEvent) => void) => void;
    removeShortcutFailedListener: () => void;
    onUpdateStatus: (callback: (status: unknown) => void) => void;
    removeUpdateListener: () => void;
    checkForUpdates: () => Promise<UpdateCheckResult>;
    downloadUpdate: () => Promise<UpdateDownloadResult>;
    installUpdate: () => Promise<void>;
    getUpdateStatus: () => Promise<unknown>;
    getAppVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
    send: (channel: string, ...args: unknown[]) => void;
    receive?: (channel: string, callback: (...args: unknown[]) => void) => void;
    invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>;
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
