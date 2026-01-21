/**
 * i18n Type Definitions
 *
 * Type-safe translation keys and language configuration
 */
export type LanguageCode = 'en' | 'ko';
export type UserLanguagePreference = 'auto' | LanguageCode;
export type TranslationNamespace = 'common' | 'settings' | 'analysis' | 'help' | 'errors' | 'tray';
export declare const SUPPORTED_LANGUAGES: Record<LanguageCode, string>;
export declare const DEFAULT_LANGUAGE: LanguageCode;
export declare const LANGUAGE_OPTIONS: Array<{
    value: UserLanguagePreference;
    label: string;
}>;
export declare function isSupportedLanguage(code: string): code is LanguageCode;
export declare function resolveLanguage(preference: UserLanguagePreference, systemLocale: string): LanguageCode;
