/**
 * IPC Handlers: Clipboard & Apply
 */

import { clipboard, ipcMain, Notification, type BrowserWindow } from 'electron';
import type { ApplyTextResult } from '../text-selection.js';

export interface ClipboardHandlerDeps {
  mainWindow: () => BrowserWindow | null;
  lastFrontmostApp: () => string | null;
  showNotification: (title: string, body: string) => void;
  applyTextToApp: (text: string, appName: string) => Promise<ApplyTextResult>;
  isBlockedApp: (appName: string | null) => boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function registerClipboardHandlers(deps: ClipboardHandlerDeps): void {
  const { mainWindow, lastFrontmostApp, showNotification, applyTextToApp, t } = deps;

  ipcMain.handle('get-clipboard', () => {
    return clipboard.readText();
  });

  ipcMain.handle('set-clipboard', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('apply-improved-prompt', async (_event, text: string): Promise<ApplyTextResult> => {
    const sourceApp = lastFrontmostApp();
    if (!sourceApp) {
      clipboard.writeText(text);
      const clipboardMessage = t('common:notifications.copiedToClipboard');
      showNotification('PromptLint', clipboardMessage);
      return {
        success: false,
        fallback: 'clipboard',
        message: clipboardMessage,
      };
    }

    const result = await applyTextToApp(text, sourceApp);

    if (result.success) {
      showNotification('PromptLint', t('common:notifications.promptApplied'));
      const win = mainWindow();
      if (win && !win.isDestroyed()) {
        win.hide();
      }
    } else if (result.fallback === 'clipboard') {
      showNotification('PromptLint', result.message || t('common:notifications.copiedToClipboard'));
    }

    return result;
  });
}
