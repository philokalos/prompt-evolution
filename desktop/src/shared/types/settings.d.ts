/**
 * Settings Types
 * Types for user preferences, app settings, and i18n.
 */
/**
 * Desktop-specific user settings
 */
export interface UserSettings {
    shortcut: string;
    windowBounds: {
        width: number;
        height: number;
    };
    alwaysOnTop: boolean;
    showTrayIcon: boolean;
    autoLaunch: boolean;
}
/**
 * Supported language codes
 */
export type LanguageCode = 'auto' | 'en' | 'ko';
/**
 * Language info result from get-language
 */
export interface LanguageResult {
    preference: string;
    resolved: string;
    systemLanguage: string;
}
/**
 * Set language result
 */
export interface SetLanguageResult {
    success: boolean;
    resolvedLanguage?: string;
    error?: string;
}
/**
 * Language changed event payload
 */
export interface LanguageChangedEvent {
    language: string;
    source: string;
}
/**
 * Supported AI provider types
 */
export type ProviderType = 'claude' | 'openai' | 'gemini';
/**
 * Multi-provider configuration
 */
export interface ProviderConfig {
    provider: ProviderType;
    apiKey: string;
    isEnabled: boolean;
    isPrimary: boolean;
    priority: number;
    displayName?: string;
    modelId?: string;
}
/**
 * Shortcut registration failure event
 */
export interface ShortcutFailedEvent {
    shortcut: string;
    message: string;
}
/**
 * Update status event
 */
export interface UpdateStatusEvent {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    progress?: number;
    error?: string;
}
