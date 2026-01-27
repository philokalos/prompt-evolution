/**
 * i18n Initialization for Renderer Process
 *
 * Configures react-i18next with bundled translations
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import all translations
import enCommon from './en/common.json';
import enSettings from './en/settings.json';
import enAnalysis from './en/analysis.json';
import enHelp from './en/help.json';
import enErrors from './en/errors.json';
import enTray from './en/tray.json';
import enOnboarding from './en/onboarding.json';

import koCommon from './ko/common.json';
import koSettings from './ko/settings.json';
import koAnalysis from './ko/analysis.json';
import koHelp from './ko/help.json';
import koErrors from './ko/errors.json';
import koTray from './ko/tray.json';
import koOnboarding from './ko/onboarding.json';

import { DEFAULT_LANGUAGE, type LanguageCode } from './types';

// Bundle all translations
const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
    analysis: enAnalysis,
    help: enHelp,
    errors: enErrors,
    tray: enTray,
    onboarding: enOnboarding,
  },
  ko: {
    common: koCommon,
    settings: koSettings,
    analysis: koAnalysis,
    help: koHelp,
    errors: koErrors,
    tray: koTray,
    onboarding: koOnboarding,
  },
};

// Initialize i18n with default language (will be updated after IPC call)
i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE, // Will be updated by initializeLanguage()
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  ns: ['common', 'settings', 'analysis', 'help', 'errors', 'tray', 'onboarding'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // Avoid Suspense issues in Electron
  },
});

/**
 * Initialize language from main process settings
 * Should be called early in app startup (e.g., in App.tsx useEffect)
 */
export async function initializeLanguage(): Promise<LanguageCode> {
  try {
    // Check if electronAPI is available (we're in Electron renderer)
    if (typeof window !== 'undefined' && window.electronAPI?.getLanguage) {
      const { resolved } = await window.electronAPI.getLanguage();
      if (resolved && (resolved === 'en' || resolved === 'ko')) {
        await changeLanguage(resolved as LanguageCode);
        return resolved as LanguageCode;
      }
    }
  } catch (error) {
    console.warn('[i18n] Failed to get language from main process:', error);
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Change the current language
 */
export function changeLanguage(language: LanguageCode): Promise<void> {
  return new Promise((resolve, reject) => {
    i18n.changeLanguage(language, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get current language
 */
export function getCurrentLanguage(): LanguageCode {
  return i18n.language as LanguageCode;
}

export default i18n;
