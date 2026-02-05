/**
 * IPC Channel Constants and Types
 * Centralized IPC channel definitions for type-safe communication
 * between main process, preload, and renderer.
 */
/**
 * IPC channels for invoke (request-response) pattern
 */
export declare const IPC_INVOKE_CHANNELS: {
    readonly GET_CLIPBOARD: "get-clipboard";
    readonly SET_CLIPBOARD: "set-clipboard";
    readonly GET_SETTINGS: "get-settings";
    readonly SET_SETTING: "set-setting";
    readonly HIDE_WINDOW: "hide-window";
    readonly MINIMIZE_WINDOW: "minimize-window";
    readonly APPLY_IMPROVED_PROMPT: "apply-improved-prompt";
    readonly ANALYZE_PROMPT: "analyze-prompt";
    readonly GET_AI_VARIANT: "get-ai-variant";
    readonly GET_PROVIDERS: "get-providers";
    readonly SET_PROVIDERS: "set-providers";
    readonly VALIDATE_PROVIDER_KEY: "validate-provider-key";
    readonly GET_PRIMARY_PROVIDER: "get-primary-provider";
    readonly HAS_ANY_PROVIDER: "has-any-provider";
    readonly GET_AI_VARIANT_WITH_PROVIDERS: "get-ai-variant-with-providers";
    readonly GET_HISTORY: "get-history";
    readonly GET_SCORE_TREND: "get-score-trend";
    readonly GET_GOLDEN_AVERAGES: "get-golden-averages";
    readonly GET_TOP_WEAKNESSES: "get-top-weaknesses";
    readonly GET_STATS: "get-stats";
    readonly GET_WEEKLY_STATS: "get-weekly-stats";
    readonly GET_MONTHLY_STATS: "get-monthly-stats";
    readonly GET_IMPROVEMENT_ANALYSIS: "get-improvement-analysis";
    readonly GET_SESSION_CONTEXT: "get-session-context";
    readonly GET_CURRENT_PROJECT: "get-current-project";
    readonly GET_ALL_OPEN_PROJECTS: "get-all-open-projects";
    readonly SELECT_PROJECT: "select-project";
    readonly GET_PROJECT_PATTERNS: "get-project-patterns";
    readonly GET_CONTEXT_RECOMMENDATIONS: "get-context-recommendations";
    readonly GET_ISSUE_PATTERNS: "get-issue-patterns";
    readonly GET_GOLDEN_TREND_BY_DIMENSION: "get-golden-trend-by-dimension";
    readonly GET_CONSECUTIVE_IMPROVEMENTS: "get-consecutive-improvements";
    readonly GET_CATEGORY_PERFORMANCE: "get-category-performance";
    readonly GET_PREDICTED_SCORE: "get-predicted-score";
    readonly GET_PROJECT_SETTINGS: "get-project-settings";
    readonly SAVE_PROJECT_SETTINGS: "save-project-settings";
    readonly DELETE_PROJECT_SETTINGS: "delete-project-settings";
    readonly GET_TEMPLATES: "get-templates";
    readonly GET_TEMPLATE: "get-template";
    readonly SAVE_TEMPLATE: "save-template";
    readonly DELETE_TEMPLATE: "delete-template";
    readonly GET_RECOMMENDED_TEMPLATE: "get-recommended-template";
    readonly INCREMENT_TEMPLATE_USAGE: "increment-template-usage";
    readonly RENDERER_READY: "renderer-ready";
    readonly CHECK_FOR_UPDATES: "check-for-updates";
    readonly DOWNLOAD_UPDATE: "download-update";
    readonly INSTALL_UPDATE: "install-update";
    readonly GET_UPDATE_STATUS: "get-update-status";
    readonly GET_APP_VERSION: "get-app-version";
    readonly OPEN_EXTERNAL: "open-external";
    readonly GET_LANGUAGE: "get-language";
    readonly SET_LANGUAGE: "set-language";
};
/**
 * IPC channels for send (one-way) pattern from main to renderer
 */
export declare const IPC_SEND_CHANNELS: {
    readonly CLIPBOARD_TEXT: "clipboard-text";
    readonly EMPTY_STATE: "empty-state";
    readonly PROMPT_DETECTED: "prompt-detected";
    readonly PROJECT_CHANGED: "project-changed";
    readonly NAVIGATE: "navigate";
    readonly SHOW_ONBOARDING: "show-onboarding";
    readonly SHOW_ABOUT: "show-about";
    readonly SHORTCUT_FAILED: "shortcut-failed";
    readonly UPDATE_STATUS: "update-status";
    readonly LANGUAGE_CHANGED: "language-changed";
    readonly ANALYSIS_RESULT: "analysis-result";
};
export type IPCInvokeChannel = typeof IPC_INVOKE_CHANNELS[keyof typeof IPC_INVOKE_CHANNELS];
export type IPCSendChannel = typeof IPC_SEND_CHANNELS[keyof typeof IPC_SEND_CHANNELS];
export type IPCChannel = IPCInvokeChannel | IPCSendChannel;
/**
 * Standard success response with optional data
 */
export interface IPCSuccessResponse<T = unknown> {
    success: true;
    data?: T;
}
/**
 * Standard error response
 */
export interface IPCErrorResponse {
    success: false;
    error: string;
}
/**
 * Generic IPC response type
 */
export type IPCResponse<T = unknown> = IPCSuccessResponse<T> | IPCErrorResponse;
/**
 * Apply improved prompt result
 */
export interface ApplyPromptResult {
    success: boolean;
    fallback?: 'clipboard';
    message?: string;
}
/**
 * Provider key validation result
 */
export interface ValidateKeyResult {
    valid: boolean;
    error?: string | null;
}
/**
 * Update check result
 */
export interface UpdateCheckResult {
    available: boolean;
    version?: string;
    error?: string;
}
/**
 * Update download result
 */
export interface UpdateDownloadResult {
    success: boolean;
    error?: string;
}
