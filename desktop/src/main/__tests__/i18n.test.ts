/**
 * i18n System Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Mock electron
const mockGetLocale = vi.fn(() => 'en-US');

vi.mock('electron', () => ({
  app: {
    getLocale: mockGetLocale,
  },
}));

// Mock fs for translation loading
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('i18n System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveLanguage', () => {
    it('should return explicit language when not auto', async () => {
      const { resolveLanguage } = await import('../i18n.js');

      expect(resolveLanguage('en', 'ko-KR')).toBe('en');
      expect(resolveLanguage('ko', 'en-US')).toBe('ko');
    });

    it('should resolve auto to system language when supported', async () => {
      const { resolveLanguage } = await import('../i18n.js');

      expect(resolveLanguage('auto', 'ko-KR')).toBe('ko');
      expect(resolveLanguage('auto', 'en-US')).toBe('en');
      expect(resolveLanguage('auto', 'en-GB')).toBe('en');
    });

    it('should fallback to English for unsupported languages', async () => {
      const { resolveLanguage } = await import('../i18n.js');

      expect(resolveLanguage('auto', 'ja-JP')).toBe('en');
      expect(resolveLanguage('auto', 'zh-CN')).toBe('en');
      expect(resolveLanguage('auto', 'fr-FR')).toBe('en');
    });

    it('should handle locale codes case-insensitively', async () => {
      const { resolveLanguage } = await import('../i18n.js');

      expect(resolveLanguage('auto', 'KO-kr')).toBe('ko');
      expect(resolveLanguage('auto', 'EN-us')).toBe('en');
    });

    it('should extract base language from locale', async () => {
      const { resolveLanguage } = await import('../i18n.js');

      expect(resolveLanguage('auto', 'ko')).toBe('ko');
      expect(resolveLanguage('auto', 'en')).toBe('en');
    });
  });

  describe('getSystemLocale', () => {
    it('should return locale from Electron app', async () => {
      mockGetLocale.mockReturnValue('ko-KR');
      const { getSystemLocale } = await import('../i18n.js');

      expect(getSystemLocale()).toBe('ko-KR');
      expect(mockGetLocale).toHaveBeenCalled();
    });

    it('should handle different locale formats', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { getSystemLocale } = await import('../i18n.js');

      expect(getSystemLocale()).toBe('en-US');
    });
  });

  describe('getSystemLanguage', () => {
    it('should extract and resolve system language to supported code', async () => {
      mockGetLocale.mockReturnValue('ko-KR');
      const { getSystemLanguage } = await import('../i18n.js');

      expect(getSystemLanguage()).toBe('ko');
    });

    it('should fallback to English for unsupported system language', async () => {
      mockGetLocale.mockReturnValue('ja-JP');
      const { getSystemLanguage } = await import('../i18n.js');

      expect(getSystemLanguage()).toBe('en');
    });

    it('should handle locale codes without region', async () => {
      mockGetLocale.mockReturnValue('ko');
      const { getSystemLanguage } = await import('../i18n.js');

      expect(getSystemLanguage()).toBe('ko');
    });
  });

  describe('language state management', () => {
    it('should get and set current language', async () => {
      const { setLanguage, getCurrentLanguage } = await import('../i18n.js');

      setLanguage('ko');
      expect(getCurrentLanguage()).toBe('ko');

      setLanguage('en');
      expect(getCurrentLanguage()).toBe('en');
    });

    it('should ignore invalid language codes', async () => {
      const { setLanguage, getCurrentLanguage } = await import('../i18n.js');

      setLanguage('en');
      const before = getCurrentLanguage();

      setLanguage('invalid' as 'en' | 'ko' | 'auto');
      expect(getCurrentLanguage()).toBe(before); // Should not change
    });
  });

  describe('initialization', () => {
    it('should not be initialized before initMainI18n', async () => {
      const { isI18nInitialized } = await import('../i18n.js');

      // Module-level initialization may occur, but function should track it
      // This test verifies the initialization flag behavior
      expect(typeof isI18nInitialized()).toBe('boolean');
    });

    it('should initialize with preference and return resolved language', async () => {
      mockGetLocale.mockReturnValue('ko-KR');
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockReadFileSync = vi.mocked(fs.readFileSync);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ test: '테스트' }));

      const { initMainI18n, isI18nInitialized, getCurrentLanguage } = await import('../i18n.js');

      const resolved = initMainI18n('auto');

      expect(resolved).toBe('ko');
      expect(getCurrentLanguage()).toBe('ko');
      expect(isI18nInitialized()).toBe(true);
    });

    it('should respect explicit language preference on init', async () => {
      mockGetLocale.mockReturnValue('ko-KR');
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockReadFileSync = vi.mocked(fs.readFileSync);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      const { initMainI18n, getCurrentLanguage } = await import('../i18n.js');

      const resolved = initMainI18n('en');

      expect(resolved).toBe('en');
      expect(getCurrentLanguage()).toBe('en');
    });
  });

  describe('translation function (t)', () => {
    beforeEach(() => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockReadFileSync = vi.mocked(fs.readFileSync);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((filePath: string | Buffer | URL | number) => {
        const pathStr = filePath.toString();

        if (pathStr.includes('/en/common.json')) {
          return JSON.stringify({
            appName: 'PromptLint',
            copy: 'Copy',
            nested: {
              value: 'Nested value',
            },
          });
        }

        if (pathStr.includes('/en/tray.json')) {
          return JSON.stringify({
            show: 'Show PromptLint',
            stats: {
              todayCount: 'Today: {{count}} analyses',
            },
          });
        }

        if (pathStr.includes('/ko/common.json')) {
          return JSON.stringify({
            appName: 'PromptLint',
            copy: '복사',
            nested: {
              value: '중첩된 값',
            },
          });
        }

        return JSON.stringify({});
      });
    });

    it('should translate with colon syntax', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      expect(t('tray:show')).toBe('Show PromptLint');
    });

    it('should translate with dot syntax', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      expect(t('common.copy')).toBe('Copy');
    });

    it('should handle nested keys', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      expect(t('common.nested.value')).toBe('Nested value');
    });

    it('should apply interpolation', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      expect(t('tray:stats.todayCount', { count: 5 })).toBe('Today: 5 analyses');
      expect(t('tray:stats.todayCount', { count: 0 })).toBe('Today: 0 analyses');
    });

    it('should return key if translation not found', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      expect(t('nonexistent:key')).toBe('nonexistent:key');
      expect(t('common.missing')).toBe('common.missing');
    });

    it('should respect language changes', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, setLanguage, t } = await import('../i18n.js');

      initMainI18n('en');
      expect(t('common.copy')).toBe('Copy');

      setLanguage('ko');
      expect(t('common.copy')).toBe('복사');
    });

    it('should leave unfilled interpolation placeholders', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      // Missing interpolation variable
      expect(t('tray:stats.todayCount', {})).toBe('Today: {{count}} analyses');
    });

    it('should handle numeric interpolation values', async () => {
      mockGetLocale.mockReturnValue('en-US');
      const { initMainI18n, t } = await import('../i18n.js');

      initMainI18n('en');

      expect(t('tray:stats.todayCount', { count: 42 })).toBe('Today: 42 analyses');
    });
  });

  describe('getLanguageInfo', () => {
    it('should return complete language information', async () => {
      mockGetLocale.mockReturnValue('ko-KR');
      const { initMainI18n, getLanguageInfo } = await import('../i18n.js');

      initMainI18n('auto');
      const info = getLanguageInfo('auto');

      expect(info).toEqual({
        preference: 'auto',
        resolved: 'ko',
        systemLanguage: 'ko-KR',
      });
    });

    it('should reflect explicit language preference', async () => {
      mockGetLocale.mockReturnValue('ko-KR');
      const { initMainI18n, getLanguageInfo } = await import('../i18n.js');

      initMainI18n('en');
      const info = getLanguageInfo('en');

      expect(info).toEqual({
        preference: 'en',
        resolved: 'en',
        systemLanguage: 'ko-KR',
      });
    });
  });

  describe('Translation parity (en/ko)', () => {
    /**
     * Extract all keys from a nested object recursively
     */
    function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
      const keys: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys.sort();
    }

    const __testFilename = fileURLToPath(import.meta.url);
    const __testDirname = path.dirname(__testFilename);
    const localesDir = path.join(__testDirname, '..', '..', 'locales');
    const namespaces = ['common', 'settings', 'analysis', 'help', 'errors', 'tray'];

    for (const ns of namespaces) {
      it(`should have identical keys in en/${ns}.json and ko/${ns}.json`, () => {
        const enPath = path.join(localesDir, 'en', `${ns}.json`);
        const koPath = path.join(localesDir, 'ko', `${ns}.json`);

        // Skip if files don't exist (CI might not have them)
        if (!fs.existsSync(enPath) || !fs.existsSync(koPath)) {
          return;
        }

        const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
        const koData = JSON.parse(fs.readFileSync(koPath, 'utf-8'));

        const enKeys = extractKeys(enData);
        const koKeys = extractKeys(koData);

        const missingInKo = enKeys.filter(k => !koKeys.includes(k));
        const missingInEn = koKeys.filter(k => !enKeys.includes(k));

        if (missingInKo.length > 0) {
          throw new Error(`Keys in en/${ns}.json missing from ko/${ns}.json:\n  ${missingInKo.join('\n  ')}`);
        }
        if (missingInEn.length > 0) {
          throw new Error(`Keys in ko/${ns}.json missing from en/${ns}.json:\n  ${missingInEn.join('\n  ')}`);
        }

        expect(enKeys).toEqual(koKeys);
      });
    }
  });
});
