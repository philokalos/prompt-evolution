/**
 * Electron App Helper for E2E Tests
 *
 * Provides utilities to launch and interact with the Electron app during tests.
 */

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

export interface ElectronAppContext {
  app: ElectronApplication;
  mainWindow: Page;
  _testDbDir?: string;
}

/**
 * Launch the Electron app for testing
 */
export async function launchElectronApp(): Promise<ElectronAppContext> {
  // Path to the main entry point
  const mainPath = join(process.cwd(), 'dist', 'main', 'index.js');

  // Create isolated temp DB directory to avoid conflicts with running app
  const testDbDir = mkdtempSync(join(tmpdir(), 'promptlint-e2e-'));

  // Launch Electron with the built app
  const app = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PROMPTLINT_DB_DIR: testDbDir,
      // Disable auto-update checks in test
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  // Wait for the main window to be created
  const mainWindow = await app.firstWindow();

  // Wait for the window to be ready
  await mainWindow.waitForLoadState('domcontentloaded');

  return { app, mainWindow, _testDbDir: testDbDir };
}

/**
 * Close the Electron app gracefully
 */
export async function closeElectronApp(context: ElectronAppContext): Promise<void> {
  await context.app.close();

  // Clean up temp DB directory
  if (context._testDbDir) {
    try {
      rmSync(context._testDbDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Simple delay utility (use when mainWindow is not available)
 */
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the main window's title
 */
export async function getWindowTitle(window: Page): Promise<string> {
  return await window.title();
}

/**
 * Wait for a specific text to appear in the window
 */
export async function waitForText(window: Page, text: string, timeout = 5000): Promise<void> {
  await window.waitForSelector(`text=${text}`, { timeout });
}

/**
 * Call an IPC handler through the renderer's electronAPI.
 * This uses the real IPC mechanism (ipcRenderer.invoke → ipcMain.handle),
 * which ensures native modules like better-sqlite3 are properly available.
 *
 * Playwright's app.evaluate() runs in a UtilityScript context where native
 * Node.js addons can't be loaded, so direct handler invocation fails for
 * DB-accessing handlers. Going through the renderer avoids this issue.
 */
export async function invokeIPC<T = any>(
  app: ElectronApplication,
  channel: string,
  ...args: any[]
): Promise<T> {
  const mainWindow = app.windows()[0];

  if (mainWindow) {
    // Convert kebab-case channel to camelCase method name
    // e.g., 'get-history' → 'getHistory', 'set-language' → 'setLanguage'
    const methodName = channel.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    // Special case: renderer-ready → signalReady (preload uses different name)
    const apiMethod = methodName === 'rendererReady' ? 'signalReady' : methodName;

    return await mainWindow.evaluate(
      async ({ method, args }: { method: string; args: unknown[] }) => {
        const api = (window as any).electronAPI;
        if (api && typeof api[method] === 'function') {
          return await api[method](...args);
        }
        throw new Error(`electronAPI.${method} not found`);
      },
      { method: apiMethod, args }
    );
  }

  // Fallback: direct handler invocation via app.evaluate
  // (only when no renderer window is available)
  return await app.evaluate(
    async ({ ipcMain }, { channel, args }) => {
      const mockEvent = {
        sender: { send: () => {} },
        reply: () => {},
      };

      const invokeHandlers = (ipcMain as any)._invokeHandlers;
      if (invokeHandlers && invokeHandlers.has(channel)) {
        const handler = invokeHandlers.get(channel);
        return await handler(mockEvent, ...args);
      }

      const handler = (ipcMain as any)._events[channel];
      if (!handler) {
        throw new Error(`No IPC handler found for channel: ${channel}`);
      }

      return await handler(mockEvent, ...args);
    },
    { channel, args }
  );
}

/**
 * Get all windows (main + Ghost Bar, etc.)
 */
export async function getAllWindows(app: ElectronApplication): Promise<Page[]> {
  return app.windows();
}

/**
 * Wait for a new window to be created (e.g., Ghost Bar)
 */
export async function waitForNewWindow(
  app: ElectronApplication,
  currentWindowCount: number,
  timeout = 5000
): Promise<Page> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const windows = await getAllWindows(app);
    if (windows.length > currentWindowCount) {
      // Return the newly created window
      return windows[windows.length - 1];
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timeout waiting for new window');
}

/**
 * Set clipboard content (useful for testing clipboard-based text capture)
 */
export async function setClipboard(app: ElectronApplication, text: string): Promise<void> {
  await app.evaluate(
    ({ clipboard }, text) => {
      clipboard.writeText(text);
    },
    text
  );
}

/**
 * Get clipboard content
 */
export async function getClipboard(app: ElectronApplication): Promise<string> {
  return await app.evaluate(({ clipboard }) => {
    return clipboard.readText();
  });
}

/**
 * Trigger prompt analysis through the renderer's clipboard-text listener.
 * This is the correct way to test analysis because it simulates the real flow:
 * main sends 'clipboard-text' → renderer dispatches RECEIVE_TEXT + calls analyzePrompt
 * → ipcRenderer.invoke('analyze-prompt') → main handler → result → React state update → UI.
 *
 * Using `invokeIPC(app, 'analyze-prompt', ...)` only runs the handler in the
 * main process — the result never reaches the renderer.
 */
export async function analyzePrompt(
  app: ElectronApplication,
  mainWindow: Page,
  text: string
): Promise<void> {
  if (!text) {
    // Empty text triggers empty-state via a different channel
    await app.evaluate(
      ({ BrowserWindow }, payload) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send('empty-state', payload);
        }
      },
      { reason: 'empty-clipboard', appName: null, capturedContext: null }
    );
    return;
  }

  await app.evaluate(
    ({ BrowserWindow }, payload) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('clipboard-text', payload);
      }
    },
    {
      text,
      capturedContext: null,
      isSourceAppBlocked: false,
      sourceApp: 'test',
    }
  );
}

/**
 * Wait for analysis to complete (grade badge visible in UI)
 */
export async function waitForAnalysis(window: Page, timeout = 10000): Promise<void> {
  await window.waitForSelector('.grade-badge', { timeout });
}

/**
 * Check if the app is ready (renderer has signaled ready)
 */
export async function waitForAppReady(window: Page, timeout = 10000): Promise<void> {
  // Wait for the main app component to be rendered
  await window.waitForSelector('[data-testid="app-root"], #root', { timeout });
}

/**
 * Take a screenshot of a window
 */
export async function takeScreenshot(
  window: Page,
  path: string
): Promise<void> {
  await window.screenshot({ path, fullPage: true });
}
