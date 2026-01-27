/**
 * IPC Handlers: Settings & Language
 */

import { ipcMain, type BrowserWindow } from 'electron';
import type Store from 'electron-store';
import type { UserLanguagePreference, LanguageCode } from '../i18n.js';

export interface SettingsHandlerDeps {
  store: Store<Record<string, unknown>>;
  mainWindow: () => BrowserWindow | null;
  registerShortcut: () => boolean;
  initProjectPolling: () => void;
  initClipboardWatch: () => void;
  initAIContextPolling: () => void;
  rebuildTrayMenu: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  setLanguage: (lang: LanguageCode) => void;
  getLanguageInfo: (preference: UserLanguagePreference) => unknown;
  resolveLanguage: (preference: UserLanguagePreference, systemLocale: string) => LanguageCode;
  getSystemLocale: () => string;
  globalShortcut: Electron.GlobalShortcut;
}

export function registerSettingsHandlers(deps: SettingsHandlerDeps): void {
  const {
    store, mainWindow, registerShortcut, initProjectPolling,
    initClipboardWatch, initAIContextPolling, rebuildTrayMenu,
    t, setLanguage, getLanguageInfo, resolveLanguage, getSystemLocale,
    globalShortcut,
  } = deps;

  ipcMain.handle('get-settings', () => {
    return store.store;
  });

  ipcMain.handle('set-setting', (_event, key: string, value: unknown): { success: boolean; error?: string } => {
    try {
      // For shortcut changes, unregister old first
      const oldShortcut = key === 'shortcut' ? (store.get('shortcut') as string) : null;

      store.set(key, value);

      // Re-register shortcut if it changed
      if (key === 'shortcut' && oldShortcut) {
        globalShortcut.unregister(oldShortcut);
        const success = registerShortcut();
        const win = mainWindow();
        if (!success && win) {
          win.webContents.send('shortcut-failed', {
            shortcut: value as string,
            message: t('errors:settings.shortcutFailed', { shortcut: value as string }),
          });
        }
        return { success };
      }

      // Restart polling if polling settings changed
      if (key === 'enableProjectPolling' || key === 'pollingIntervalMs') {
        initProjectPolling();
      }

      // Toggle clipboard watching if setting changed
      if (key === 'enableClipboardWatch' || key === 'ghostBar') {
        initClipboardWatch();
      }

      // Toggle AI context popup if setting changed
      if (key === 'enableAIContextPopup') {
        initAIContextPolling();
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Settings] Failed to save setting:', key, errorMessage);
      return { success: false, error: t('errors:settings.saveError', { error: errorMessage }) };
    }
  });

  // Language handlers
  ipcMain.handle('get-language', () => {
    const preference = store.get('language') as UserLanguagePreference;
    return getLanguageInfo(preference);
  });

  ipcMain.handle('set-language', (_event, language: UserLanguagePreference) => {
    try {
      if (!['auto', 'en', 'ko'].includes(language)) {
        return { success: false, error: 'Invalid language code' };
      }

      store.set('language', language);
      const resolved = resolveLanguage(language, getSystemLocale());
      setLanguage(resolved);

      const win = mainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('language-changed', {
          language: resolved,
          source: 'user',
        });
      }

      if (win) {
        rebuildTrayMenu();
      }

      console.log(`[Main] Language changed: ${language} → ${resolved}`);
      return { success: true, resolvedLanguage: resolved };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Main] Failed to set language:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
}
