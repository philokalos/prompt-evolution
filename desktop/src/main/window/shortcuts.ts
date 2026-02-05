/**
 * Global Shortcuts Module
 * Handles global keyboard shortcut registration and management.
 */

import { globalShortcut, clipboard, type BrowserWindow } from 'electron';
import type Store from 'electron-store';
import { getActiveWindowInfo, parseWindowTitle } from '../active-window-detector.js';
import { captureTextForAnalysis, getFrontmostApp, isBlockedApp, type CaptureMode } from '../text-selection.js';
import type { CapturedContext } from '../app-state.js';
import { positionWindowNearCursor } from './positioning.js';

/**
 * Shortcut handler dependencies
 */
export interface ShortcutDeps {
  store: Store<Record<string, unknown>>;
  getMainWindow: () => BrowserWindow | null;
  isMainWindowValid: () => boolean;
  onTextCaptured: (text: string, context: CapturedContext | null, isBlocked: boolean) => void;
  onEmptyState: (reason: 'blocked-app' | 'no-selection' | 'empty-clipboard', appName: string | null, context: CapturedContext | null) => void;
  setContext: (ctx: CapturedContext | null) => void;
  setLastFrontmostApp: (app: string | null) => void;
}

let deps: ShortcutDeps | null = null;

/**
 * Initialize shortcut module with dependencies
 */
export function initShortcuts(dependencies: ShortcutDeps): void {
  deps = dependencies;
}

/**
 * Register the global analysis shortcut
 *
 * @returns true if registration succeeded
 */
export function registerAnalysisShortcut(): boolean {
  if (!deps) {
    console.error('[Shortcuts] Module not initialized');
    return false;
  }

  const shortcut = deps.store.get('shortcut') as string;

  // Unregister existing shortcut first
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut);
  }

  const success = globalShortcut.register(shortcut, handleAnalysisShortcut);

  if (success) {
    console.log(`[Shortcuts] ✅ Global shortcut registered: ${shortcut}`);
  } else {
    console.error(`[Shortcuts] ❌ Failed to register global shortcut: ${shortcut}`);
    console.error('[Shortcuts] Another app may be using this shortcut. Try changing it in Settings.');
  }

  return success;
}

/**
 * Handle the analysis shortcut press
 */
async function handleAnalysisShortcut(): Promise<void> {
  if (!deps) return;

  const mainWindow = deps.getMainWindow();
  if (!mainWindow) return;

  // 1. Capture window context FIRST - before any other operations
  const windowInfo = await getActiveWindowInfo();
  const project = windowInfo?.isIDE ? parseWindowTitle(windowInfo) : null;

  const capturedContext: CapturedContext = {
    windowInfo,
    project,
    timestamp: new Date(),
  };

  deps.setContext(capturedContext);
  console.log(`[Shortcuts] Captured context: ${project?.projectPath || 'no project'} (IDE: ${windowInfo?.ideName || 'none'})`);

  // Save the frontmost app name for apply feature
  const frontmostApp = windowInfo?.appName || await getFrontmostApp();
  deps.setLastFrontmostApp(frontmostApp);
  console.log(`[Shortcuts] Source app for apply: ${frontmostApp}`);

  // Get capture mode from settings
  const captureMode = deps.store.get('captureMode') as CaptureMode;

  // Capture text using configured mode
  const { text: capturedText, source } = await captureTextForAnalysis(captureMode);
  console.log(`[Shortcuts] Captured text from ${source} (mode: ${captureMode}):`, capturedText?.substring(0, 50));

  // No text captured - show empty state
  if (!capturedText) {
    const sourceAppBlocked = isBlockedApp(frontmostApp);
    const clipboardContent = clipboard.readText();

    // Determine the reason for empty state
    let reason: 'blocked-app' | 'no-selection' | 'empty-clipboard';
    if (sourceAppBlocked) {
      reason = clipboardContent ? 'no-selection' : 'blocked-app';
    } else {
      reason = 'no-selection';
    }

    console.log(`[Shortcuts] No text captured, showing empty state (reason: ${reason}, app: ${frontmostApp})`);
    deps.onEmptyState(reason, frontmostApp, capturedContext);

    // Show window with guidance
    if (!mainWindow.isVisible()) {
      positionWindowNearCursor(mainWindow);
      mainWindow.showInactive();
    }
    return;
  }

  // Text captured - send for analysis
  deps.onTextCaptured(capturedText, capturedContext, isBlockedApp(frontmostApp));

  // Show window if hidden
  if (!mainWindow.isVisible()) {
    positionWindowNearCursor(mainWindow);
    mainWindow.showInactive();
    console.log('[Shortcuts] Showing window near cursor (without stealing focus)');
  }
}

/**
 * Unregister all global shortcuts
 * Should be called when app is quitting
 */
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}

/**
 * Check if a shortcut is already registered by the system
 *
 * @param shortcut - Electron shortcut string
 * @returns true if registered
 */
export function isShortcutRegistered(shortcut: string): boolean {
  return globalShortcut.isRegistered(shortcut);
}
