/**
 * Polling Module
 * Manages project polling, clipboard watching, and AI context polling
 */

import { BrowserWindow } from 'electron';
import { store } from '../settings-store.js';
import {
  startWindowPolling,
  stopWindowPolling,
  startAIAppPolling,
  stopAIAppPolling,
  type DetectedProject,
  type DetectedAIApp,
} from '../active-window-detector.js';
import {
  getClipboardWatcher,
  destroyClipboardWatcher,
  type DetectedPrompt,
} from '../clipboard-watcher.js';
import { clearTrayBadge, setTrayBadge } from '../tray.js';
import {
  showAIContextButton,
  hideAIContextButton,
} from '../ai-context-popup.js';
import type { GhostBarSettings } from '../ghost-bar-types.js';

/**
 * State for project tracking
 */
let currentProject: DetectedProject | null = null;

/**
 * Get current detected project
 */
export function getCurrentProject(): DetectedProject | null {
  return currentProject;
}

/**
 * Polling dependencies
 */
export interface PollingDeps {
  isRendererReady: () => boolean;
  getMainWindow: () => BrowserWindow | null;
  analyzeClipboardNow: () => Promise<void>;
  handleGhostBarPrompt: (detected: DetectedPrompt) => Promise<void>;
}

/**
 * Create project change handler
 */
export function createProjectChangeHandler(deps: PollingDeps): (project: DetectedProject | null) => void {
  return (project: DetectedProject | null): void => {
    // Check if project actually changed
    const prevPath = currentProject?.projectPath;
    const newPath = project?.projectPath;

    if (prevPath === newPath) return;

    currentProject = project;

    if (project) {
      console.log(
        `[Main] Project changed: ${project.projectPath} (${project.ideName}, confidence: ${project.confidence})`
      );
    } else {
      console.log('[Main] No active project detected');
    }

    // Notify renderer of project change (with safety checks)
    const mainWindow = deps.getMainWindow();
    if (
      deps.isRendererReady() &&
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.webContents &&
      !mainWindow.webContents.isDestroyed()
    ) {
      try {
        mainWindow.webContents.send('project-changed', project);
      } catch {
        // Window may have been closed during send - ignore
      }
    }
  };
}

/**
 * Initialize or restart project polling based on settings
 */
export function initProjectPolling(onProjectChange: (project: DetectedProject | null) => void): void {
  const enabled = store.get('enableProjectPolling') as boolean;
  const interval = store.get('pollingIntervalMs') as number;

  // Stop any existing polling
  stopWindowPolling();

  if (enabled) {
    console.log(`[Main] Starting project polling (interval: ${interval}ms)`);
    startWindowPolling(interval, onProjectChange);
  } else {
    console.log('[Main] Project polling disabled');
  }
}

/**
 * Create clipboard watch handler
 */
export function createClipboardHandler(deps: PollingDeps): (detected: DetectedPrompt) => Promise<void> {
  return async (detected: DetectedPrompt): Promise<void> => {
    console.log(`[Main] Clipboard prompt detected: "${detected.text.substring(0, 50)}..."`);

    // Show badge on tray icon
    setTrayBadge(true);

    // Check if Ghost Bar is enabled
    const ghostBarSettings = store.get('ghostBar') as GhostBarSettings;
    if (ghostBarSettings?.enabled) {
      console.log('[Main] Ghost Bar enabled, processing prompt');
      await deps.handleGhostBarPrompt(detected);
      return; // Ghost Bar handles everything
    }

    // Check if auto-analyze is enabled
    const autoAnalyze = store.get('autoAnalyzeOnCopy') as boolean;
    if (autoAnalyze) {
      console.log('[Main] Auto-analyzing detected prompt');
      await deps.analyzeClipboardNow();
      return; // Skip notification if auto-analyzing
    }

    // Otherwise, show notification
    const showNotifications = store.get('showNotifications') as boolean;
    const mainWindow = deps.getMainWindow();
    if (showNotifications && mainWindow) {
      // Send to renderer to show subtle notification
      mainWindow.webContents.send('prompt-detected', {
        text: detected.text,
        confidence: detected.confidence,
      });
    }
  };
}

/**
 * Initialize or update clipboard watching based on settings
 */
export function initClipboardWatch(handler: (detected: DetectedPrompt) => Promise<void>): void {
  const clipboardWatchEnabled = store.get('enableClipboardWatch') as boolean;
  const ghostBarSettings = store.get('ghostBar') as GhostBarSettings;

  // Ghost Bar 활성화 시 자동으로 클립보드 감시 시작
  const enabled = clipboardWatchEnabled || ghostBarSettings?.enabled;
  const watcher = getClipboardWatcher();

  // Stop existing polling first to prevent race conditions
  watcher.stop();
  // Remove existing listeners to avoid duplicates
  watcher.removeAllListeners('prompt-detected');

  if (enabled) {
    // Set up prompt detection handler
    watcher.on('prompt-detected', handler);
    watcher.start();
    console.log('[Main] Clipboard watching enabled');
  } else {
    watcher.stop();
    clearTrayBadge();
    console.log('[Main] Clipboard watching disabled');
  }
}

/**
 * Create AI app change handler
 */
export function createAIAppChangeHandler(deps: PollingDeps): (aiApp: DetectedAIApp | null) => void {
  return (aiApp: DetectedAIApp | null): void => {
    if (aiApp) {
      console.log(`[Main] AI app detected: ${aiApp.aiAppType} (${aiApp.appName})`);

      // Show floating button
      showAIContextButton(() => {
        // On click: analyze clipboard content
        deps.analyzeClipboardNow();
        // Hide the button after click
        hideAIContextButton();
      });
    } else {
      console.log('[Main] No AI app active, hiding button');
      hideAIContextButton();
    }
  };
}

/**
 * Initialize or update AI context popup based on settings
 */
export function initAIContextPolling(onAIAppChange: (aiApp: DetectedAIApp | null) => void): void {
  const enabled = store.get('enableAIContextPopup') as boolean;

  // Stop any existing polling
  stopAIAppPolling();

  if (enabled) {
    console.log('[Main] Starting AI app context polling');
    // Poll every 2 seconds to detect AI app focus
    startAIAppPolling(2000, onAIAppChange);
  } else {
    console.log('[Main] AI context popup disabled');
    hideAIContextButton();
  }
}

/**
 * Stop all polling
 */
export function stopAllPolling(): void {
  stopWindowPolling();
  stopAIAppPolling();
  destroyClipboardWatcher();
}
