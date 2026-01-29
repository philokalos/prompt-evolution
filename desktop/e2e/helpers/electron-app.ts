/**
 * Electron App Helper for E2E Tests
 *
 * Provides utilities to launch and interact with the Electron app during tests.
 */

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'path';

export interface ElectronAppContext {
  app: ElectronApplication;
  mainWindow: Page;
}

/**
 * Launch the Electron app for testing
 */
export async function launchElectronApp(): Promise<ElectronAppContext> {
  // Path to the main entry point
  const mainPath = join(process.cwd(), 'dist', 'main', 'index.js');

  // Launch Electron with the built app
  const app = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Disable auto-update checks in test
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  // Wait for the main window to be created
  const mainWindow = await app.firstWindow();

  // Wait for the window to be ready
  await mainWindow.waitForLoadState('domcontentloaded');

  return { app, mainWindow };
}

/**
 * Close the Electron app gracefully
 */
export async function closeElectronApp(context: ElectronAppContext): Promise<void> {
  await context.app.close();
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
 * Simulate IPC call from renderer to main process
 *
 * Note: This directly invokes the IPC handler, bypassing the actual IPC mechanism.
 * Use this when you need to test main process logic without simulating user actions.
 */
export async function invokeIPC<T = any>(
  app: ElectronApplication,
  channel: string,
  ...args: any[]
): Promise<T> {
  return await app.evaluate(
    async ({ ipcMain }, { channel, args }) => {
      // Find the registered handler
      const handler = (ipcMain as any)._events[channel];
      if (!handler) {
        throw new Error(`No IPC handler found for channel: ${channel}`);
      }

      // Create a mock event object
      const mockEvent = {
        sender: { send: () => {} },
        reply: () => {},
      };

      // Call the handler with mock event and args
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
