/**
 * i18n Type Definitions
 *
 * Type-safe translation keys and language configuration
 */

// Supported language codes (ISO 639-1)
export type LanguageCode = 'en' | 'ko';

// User language preference options
export type UserLanguagePreference = 'auto' | LanguageCode;

// Translation namespaces
export type TranslationNamespace =
  | 'common'
  | 'settings'
  | 'analysis'
  | 'help'
  | 'errors'
  | 'tray';

// Supported languages configuration
export const SUPPORTED_LANGUAGES: Record<LanguageCode, string> = {
  en: 'English',
  ko: '한국어',
};

// Default language
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

// Language preference options for UI
export const LANGUAGE_OPTIONS: Array<{ value: UserLanguagePreference; label: string }> = [
  { value: 'auto', label: 'settings.language.auto' }, // Will be translated
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
];

// Check if a language code is supported
export function isSupportedLanguage(code: string): code is LanguageCode {
  return code === 'en' || code === 'ko';
}

// Resolve 'auto' preference to actual language code
export function resolveLanguage(
  preference: UserLanguagePreference,
  systemLocale: string
): LanguageCode {
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
