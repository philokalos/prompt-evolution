/**
 * i18n Type Definitions
 *
 * Type-safe translation keys and language configuration
 */
// Supported languages configuration
export const SUPPORTED_LANGUAGES = {
    en: 'English',
    ko: '한국어',
};
// Default language
export const DEFAULT_LANGUAGE = 'en';
// Language preference options for UI
export const LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'settings.language.auto' }, // Will be translated
    { value: 'en', label: 'English' },
    { value: 'ko', label: '한국어' },
];
// Check if a language code is supported
export function isSupportedLanguage(code) {
    return code === 'en' || code === 'ko';
}
// Resolve 'auto' preference to actual language code
export function resolveLanguage(preference, systemLocale) {
    if (preference !== 'auto') {
        return preference;
    }
    // Extract base language from locale (e.g., 'ko-KR' → 'ko')
    const baseLocale = systemLocale.split('-')[0].toLowerCase();
    if (isSupportedLanguage(baseLocale)) {
        return baseLocale;
    }
    return DEFAULT_LANGUAGE;
}
