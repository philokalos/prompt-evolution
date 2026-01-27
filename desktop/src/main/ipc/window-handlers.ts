/**
 * IPC Handlers: Window Controls & Misc
 */

import { app, ipcMain, type BrowserWindow } from 'electron';

export interface WindowHandlerDeps {
  mainWindow: () => BrowserWindow | null;
  isMainWindowValid: () => boolean;
  getIsRendererReady: () => boolean;
  setIsRendererReady: (ready: boolean) => void;
  getPendingText: () => { text: string; capturedContext: unknown; isSourceAppBlocked: boolean } | null;
  clearPendingText: () => void;
  onRendererReady: () => void;
}

export function registerWindowHandlers(deps: WindowHandlerDeps): void {
  const { mainWindow, isMainWindowValid } = deps;

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('hide-window', () => {
    if (isMainWindowValid()) {
      mainWindow()!.hide();
    }
    return true;
  });

  ipcMain.handle('minimize-window', () => {
    mainWindow()?.minimize();
    return true;
  });

  ipcMain.handle('open-external', async (_event, url: unknown) => {
    if (typeof url !== 'string') {
      console.warn('[Main] open-external: Invalid URL type');
      return { success: false, error: 'Invalid URL type' };
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn(`[Main] open-external: Blocked protocol ${parsed.protocol}`);
        return { success: false, error: `Protocol ${parsed.protocol} not allowed` };
      }

      const { shell } = await import('electron');
      await shell.openExternal(url);
      return { success: true };
    } catch {
      console.warn('[Main] open-external: Invalid URL', url);
      return { success: false, error: 'Invalid URL format' };
    }
  });

  ipcMain.handle('renderer-ready', () => {
    deps.setIsRendererReady(true);
    console.log('[Main] Renderer signaled ready');

    const pendingText = deps.getPendingText();
    const win = mainWindow();
    if (pendingText && win) {
      console.log('[Main] Sending pending text to renderer with context');
      win.webContents.send('clipboard-text', pendingText);
      deps.clearPendingText();
    }

    deps.onRendererReady();

    return true;
  });
}
