"use strict";
/**
 * IPC Channel Constants and Types
 * Centralized IPC channel definitions for type-safe communication
 * between main process, preload, and renderer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_SEND_CHANNELS = exports.IPC_INVOKE_CHANNELS = void 0;
// =============================================================================
// IPC Channel Constants
// =============================================================================
/**
 * IPC channels for invoke (request-response) pattern
 */
exports.IPC_INVOKE_CHANNELS = {
    // Clipboard operations
    GET_CLIPBOARD: 'get-clipboard',
    SET_CLIPBOARD: 'set-clipboard',
    // Settings
    GET_SETTINGS: 'get-settings',
    SET_SETTING: 'set-setting',
    // Window controls
    HIDE_WINDOW: 'hide-window',
    MINIMIZE_WINDOW: 'minimize-window',
    APPLY_IMPROVED_PROMPT: 'apply-improved-prompt',
    // Analysis
    ANALYZE_PROMPT: 'analyze-prompt',
    GET_AI_VARIANT: 'get-ai-variant',
    // Multi-provider AI API
    GET_PROVIDERS: 'get-providers',
    SET_PROVIDERS: 'set-providers',
    VALIDATE_PROVIDER_KEY: 'validate-provider-key',
    GET_PRIMARY_PROVIDER: 'get-primary-provider',
    HAS_ANY_PROVIDER: 'has-any-provider',
    GET_AI_VARIANT_WITH_PROVIDERS: 'get-ai-variant-with-providers',
    // History & Progress
    GET_HISTORY: 'get-history',
    GET_SCORE_TREND: 'get-score-trend',
    GET_GOLDEN_AVERAGES: 'get-golden-averages',
    GET_TOP_WEAKNESSES: 'get-top-weaknesses',
    GET_STATS: 'get-stats',
    GET_WEEKLY_STATS: 'get-weekly-stats',
    GET_MONTHLY_STATS: 'get-monthly-stats',
    GET_IMPROVEMENT_ANALYSIS: 'get-improvement-analysis',
    // Session context
    GET_SESSION_CONTEXT: 'get-session-context',
    // Active project detection
    GET_CURRENT_PROJECT: 'get-current-project',
    GET_ALL_OPEN_PROJECTS: 'get-all-open-projects',
    SELECT_PROJECT: 'select-project',
    // History-based recommendations
    GET_PROJECT_PATTERNS: 'get-project-patterns',
    GET_CONTEXT_RECOMMENDATIONS: 'get-context-recommendations',
    // Advanced analytics
    GET_ISSUE_PATTERNS: 'get-issue-patterns',
    GET_GOLDEN_TREND_BY_DIMENSION: 'get-golden-trend-by-dimension',
    GET_CONSECUTIVE_IMPROVEMENTS: 'get-consecutive-improvements',
    GET_CATEGORY_PERFORMANCE: 'get-category-performance',
    GET_PREDICTED_SCORE: 'get-predicted-score',
    // Project settings and templates
    GET_PROJECT_SETTINGS: 'get-project-settings',
    SAVE_PROJECT_SETTINGS: 'save-project-settings',
    DELETE_PROJECT_SETTINGS: 'delete-project-settings',
    GET_TEMPLATES: 'get-templates',
    GET_TEMPLATE: 'get-template',
    SAVE_TEMPLATE: 'save-template',
    DELETE_TEMPLATE: 'delete-template',
    GET_RECOMMENDED_TEMPLATE: 'get-recommended-template',
    INCREMENT_TEMPLATE_USAGE: 'increment-template-usage',
    // Renderer ready signal
    RENDERER_READY: 'renderer-ready',
    // Auto-updater
    CHECK_FOR_UPDATES: 'check-for-updates',
    DOWNLOAD_UPDATE: 'download-update',
    INSTALL_UPDATE: 'install-update',
    GET_UPDATE_STATUS: 'get-update-status',
    GET_APP_VERSION: 'get-app-version',
    // External links
    OPEN_EXTERNAL: 'open-external',
    // i18n Language support
    GET_LANGUAGE: 'get-language',
    SET_LANGUAGE: 'set-language',
};
/**
 * IPC channels for send (one-way) pattern from main to renderer
 */
exports.IPC_SEND_CHANNELS = {
    // Text/clipboard events
    CLIPBOARD_TEXT: 'clipboard-text',
    EMPTY_STATE: 'empty-state',
    PROMPT_DETECTED: 'prompt-detected',
    // Project events
    PROJECT_CHANGED: 'project-changed',
    // Navigation & UI triggers
    NAVIGATE: 'navigate',
    SHOW_ONBOARDING: 'show-onboarding',
    SHOW_ABOUT: 'show-about',
    // Status events
    SHORTCUT_FAILED: 'shortcut-failed',
    UPDATE_STATUS: 'update-status',
    LANGUAGE_CHANGED: 'language-changed',
    // Analysis result (for Ghost Bar)
    ANALYSIS_RESULT: 'analysis-result',
};
