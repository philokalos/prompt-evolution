/**
 * i18n Module for Main Process
 *
 * Handles language detection, translation loading, and IPC coordination
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supported language codes (ISO 639-1)
export type LanguageCode = 'en' | 'ko';

// User language preference options
export type UserLanguagePreference = 'auto' | LanguageCode;

// Default language
const DEFAULT_LANGUAGE: LanguageCode = 'en';

// Type for translation resources
type TranslationResources = Record<string, Record<string, unknown>>;

// Check if a language code is supported
function isSupportedLanguage(code: string): code is LanguageCode {
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

// Bundled translations (loaded at runtime)
const translations: Record<LanguageCode, TranslationResources> = {
  en: {},
  ko: {},
};

// Current language state
let currentLanguage: LanguageCode = DEFAULT_LANGUAGE;
let isInitialized = false;

/**
 * Load translations from JSON files
 */
function loadTranslations(): void {
  const namespaces = ['common', 'settings', 'analysis', 'help', 'errors', 'tray'];
  const languages: LanguageCode[] = ['en', 'ko'];

  // In development, load from src/locales
  // In production, the renderer will use bundled translations
  // Main process uses a simplified approach - load at runtime if needed

  for (const lang of languages) {
    for (const ns of namespaces) {
      try {
        // Try different paths based on environment
        const possiblePaths = [
          // Development: relative to src/main
          path.join(__dirname, '..', 'locales', lang, `${ns}.json`),
          // Production: after build, relative to dist/main
          path.join(__dirname, '..', '..', 'src', 'locales', lang, `${ns}.json`),
          // Alternative production path
          path.join(process.cwd(), 'src', 'locales', lang, `${ns}.json`),
        ];

        for (const filePath of possiblePaths) {
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            translations[lang][ns] = JSON.parse(content);
            break;
          }
        }
      } catch {
        console.warn(`[i18n] Failed to load ${lang}/${ns}.json`);
      }
    }
  }
}

/**
 * Initialize i18n for main process
 */
export function initMainI18n(preference: UserLanguagePreference): LanguageCode {
  loadTranslations();
  const systemLocale = getSystemLocale();
  currentLanguage = resolveLanguage(preference, systemLocale);
  isInitialized = true;
  return currentLanguage;
}

/**
 * Get system locale from Electron
 */
export function getSystemLocale(): string {
  return app.getLocale();
}

/**
 * Get system language code (resolved to supported language)
 */
export function getSystemLanguage(): LanguageCode {
  const locale = getSystemLocale();
  const baseLocale = locale.split('-')[0].toLowerCase();
  return isSupportedLanguage(baseLocale) ? baseLocale : DEFAULT_LANGUAGE;
}

/**
 * Set current language
 */
export function setLanguage(language: LanguageCode): void {
  if (isSupportedLanguage(language)) {
    currentLanguage = language;
  }
}

/**
 * Get current language
 */
export function getCurrentLanguage(): LanguageCode {
  return currentLanguage;
}

/**
 * Check if i18n is initialized
 */
export function isI18nInitialized(): boolean {
  return isInitialized;
}

/**
 * Translate a key with optional namespace and interpolation
 *
 * @param key - Translation key in format "namespace:key" or "namespace.key"
 * @param options - Interpolation options
 * @returns Translated string or key if not found
 *
 * @example
 * t('tray:show') // "Show PromptLint" or "PromptLint 보기"
 * t('common.copy') // "Copy" or "복사"
 * t('tray:stats.todayCount', { count: 5 }) // "Today: 5 analyses"
 */
export function t(key: string, options?: Record<string, unknown>): string {
  // Parse namespace and key
  let namespace = 'common';
  let translationKey = key;

  if (key.includes(':')) {
    const [ns, k] = key.split(':');
    namespace = ns;
    translationKey = k;
  } else if (key.includes('.')) {
    const firstDotIndex = key.indexOf('.');
    const possibleNs = key.substring(0, firstDotIndex);
    if (translations[currentLanguage][possibleNs]) {
      namespace = possibleNs;
      translationKey = key.substring(firstDotIndex + 1);
    }
  }

  // Get translation resource
  const resource = translations[currentLanguage]?.[namespace];
  if (!resource) {
    return key;
  }

  // Navigate to the translation value
  let value: unknown = resource;
  const keyParts = translationKey.split('.');

  for (const part of keyParts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key; // Key not found
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Apply interpolation
  if (options) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      return options[name] !== undefined ? String(options[name]) : `{{${name}}}`;
    });
  }

  return value;
}

/**
 * Get language info for IPC response
 */
export function getLanguageInfo(preference: UserLanguagePreference): {
  preference: UserLanguagePreference;
  resolved: LanguageCode;
  systemLanguage: string;
} {
  return {
    preference,
    resolved: currentLanguage,
    systemLanguage: getSystemLocale(),
  };
}
