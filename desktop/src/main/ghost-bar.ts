/**
 * Ghost Bar - Floating mini-bar for quick prompt improvement
 *
 * Shows a small floating bar near the cursor when a prompt is detected
 * in the clipboard. Allows one-click application of improved prompts.
 */

import { BrowserWindow, screen, globalShortcut, clipboard, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { GhostBarState, GhostBarShowPayload, ApplyResult, GhostBarSettings } from './ghost-bar-types.js';
import { applyTextToApp } from './text-selection.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ghost Bar dimensions
const GHOST_BAR_WIDTH = 200;
const GHOST_BAR_HEIGHT = 44;

// Module state
let ghostBarWindow: BrowserWindow | null = null;
let currentState: GhostBarState | null = null;
let dismissTimeout: NodeJS.Timeout | null = null;
let shortcutsRegistered = false;

// Callbacks for integration with main process
let onExpandCallback: ((state: GhostBarState) => void) | null = null;
let onApplyCallback: ((state: GhostBarState) => void) | null = null;

/**
 * Calculate Ghost Bar position based on cursor location
 * Handles multi-monitor setups and screen boundary adjustments
 */
function calculatePosition(cursor: Electron.Point, display: Electron.Display): { x: number; y: number } {
  const { workArea } = display;
  let x = cursor.x;
  let y = cursor.y + 8; // 8px below cursor

  // Adjust for right screen boundary
  if (x + GHOST_BAR_WIDTH > workArea.x + workArea.width) {
    x = cursor.x - GHOST_BAR_WIDTH;
  }

  // Adjust for left screen boundary
  if (x < workArea.x) {
    x = workArea.x;
  }

  // Adjust for bottom screen boundary
  if (y + GHOST_BAR_HEIGHT > workArea.y + workArea.height) {
    y = cursor.y - GHOST_BAR_HEIGHT - 8; // 8px above cursor
  }

  // Adjust for top screen boundary
  if (y < workArea.y) {
    y = workArea.y;
  }

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Create the Ghost Bar window
 */
export function createGhostBar(preloadPath?: string): void {
  if (ghostBarWindow && !ghostBarWindow.isDestroyed()) {
    return; // Already exists
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const position = calculatePosition(cursor, display);

  const resolvedPreloadPath = preloadPath || path.join(__dirname, '../preload/index.cjs');

  ghostBarWindow = new BrowserWindow({
    width: GHOST_BAR_WIDTH,
    height: GHOST_BAR_HEIGHT,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true, // Allow focus for button clicks
    acceptFirstMouse: true, // Accept clicks without requiring focus first
    hasShadow: true,
    type: 'panel', // macOS: Prevents keyboard interference
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolvedPreloadPath,
    },
  });

  // NOTE: setIgnoreMouseEvents 제거 - 버튼 클릭 가능하도록
  // ghostBarWindow.setIgnoreMouseEvents(true, { forward: true });

  // Visible on all workspaces but not on fullscreen
  ghostBarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  // Load the Ghost Bar HTML
  const htmlContent = getGhostBarHTML();
  ghostBarWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  // Handle window close
  ghostBarWindow.on('closed', () => {
    ghostBarWindow = null;
    currentState = null;
    clearDismissTimeout();
    unregisterGhostBarShortcuts();
  });

  console.log('[GhostBar] Created at position:', position);
}

/**
 * Show the Ghost Bar with analysis results
 */
export function showGhostBar(state: GhostBarState, settings: GhostBarSettings): void {
  if (!ghostBarWindow || ghostBarWindow.isDestroyed()) {
    createGhostBar();
  }

  // Update position to current cursor location
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const position = calculatePosition(cursor, display);
  ghostBarWindow?.setPosition(position.x, position.y);

  currentState = state;

  const payload: GhostBarShowPayload = {
    originalGrade: state.originalGrade,
    improvedGrade: state.improvedGrade,
    originalScore: state.originalScore,
    improvedScore: state.improvedScore,
    isBlockedApp: state.isBlockedApp,
    sourceApp: state.sourceApp,
  };

  // Send data to renderer
  ghostBarWindow?.webContents.send('ghost-bar:show', payload);

  // Show window with fade-in
  ghostBarWindow?.show();

  // Register shortcuts
  registerGhostBarShortcuts();

  // Start auto-dismiss timer
  startDismissTimeout(settings.dismissTimeout);

  console.log('[GhostBar] Shown with state:', {
    originalGrade: state.originalGrade,
    improvedGrade: state.improvedGrade,
  });
}

/**
 * Hide the Ghost Bar with fade-out animation
 */
export function hideGhostBar(): void {
  if (!ghostBarWindow || ghostBarWindow.isDestroyed()) {
    return;
  }

  // Send hide signal for fade-out animation
  ghostBarWindow.webContents.send('ghost-bar:hide');

  // Unregister shortcuts
  unregisterGhostBarShortcuts();

  // Clear dismiss timer
  clearDismissTimeout();

  // Hide after animation (100ms)
  setTimeout(() => {
    if (ghostBarWindow && !ghostBarWindow.isDestroyed()) {
      ghostBarWindow.hide();
    }
  }, 100);

  console.log('[GhostBar] Hidden');
}

/**
 * Destroy the Ghost Bar window
 */
export function destroyGhostBar(): void {
  clearDismissTimeout();
  unregisterGhostBarShortcuts();

  if (ghostBarWindow && !ghostBarWindow.isDestroyed()) {
    ghostBarWindow.destroy();
    ghostBarWindow = null;
    currentState = null;
    console.log('[GhostBar] Destroyed');
  }
}

/**
 * Check if Ghost Bar is visible
 */
export function isGhostBarVisible(): boolean {
  return ghostBarWindow !== null && !ghostBarWindow.isDestroyed() && ghostBarWindow.isVisible();
}

/**
 * Get current Ghost Bar state
 */
export function getCurrentGhostBarState(): GhostBarState | null {
  return currentState;
}

/**
 * Register global shortcuts for Ghost Bar
 */
function registerGhostBarShortcuts(): void {
  if (shortcutsRegistered) {
    return;
  }

  // Cmd+Shift+Enter: Apply improvement
  const applyRegistered = globalShortcut.register('CommandOrControl+Shift+Return', () => {
    console.log('[GhostBar] Apply shortcut triggered');
    handleApply();
  });

  // Escape: Dismiss
  const escapeRegistered = globalShortcut.register('Escape', () => {
    console.log('[GhostBar] Escape shortcut triggered');
    hideGhostBar();
  });

  shortcutsRegistered = applyRegistered && escapeRegistered;

  if (!shortcutsRegistered) {
    console.warn('[GhostBar] Failed to register some shortcuts');
  } else {
    console.log('[GhostBar] Shortcuts registered');
  }
}

/**
 * Unregister global shortcuts for Ghost Bar
 */
function unregisterGhostBarShortcuts(): void {
  if (!shortcutsRegistered) {
    return;
  }

  try {
    globalShortcut.unregister('CommandOrControl+Shift+Return');
    globalShortcut.unregister('Escape');
    shortcutsRegistered = false;
    console.log('[GhostBar] Shortcuts unregistered');
  } catch (error) {
    console.error('[GhostBar] Error unregistering shortcuts:', error);
  }
}

/**
 * Handle apply action
 */
async function handleApply(): Promise<ApplyResult> {
  console.log('[GhostBar] handleApply called, currentState:', currentState ? 'exists' : 'null');

  if (!currentState) {
    console.log('[GhostBar] No currentState, returning early');
    return { success: false, message: 'No active state' };
  }

  const state = currentState;

  console.log('[GhostBar] State:', {
    hasOriginal: !!state.originalText,
    hasImproved: !!state.improvedText,
    improvedLength: state.improvedText?.length || 0,
    originalGrade: state.originalGrade,
    improvedGrade: state.improvedGrade,
  });

  // Validate improved text
  if (!state.improvedText || state.improvedText.trim().length === 0) {
    console.log('[GhostBar] No improved text available');
    return { success: false, message: 'No improved text available' };
  }

  // Write improved text to clipboard
  console.log('[GhostBar] Writing to clipboard:', state.improvedText.substring(0, 50) + '...');
  clipboard.writeText(state.improvedText);
  console.log('[GhostBar] Wrote improved text to clipboard (length:', state.improvedText.length, ')');

  let result: ApplyResult = { success: true };

  // Auto-paste if not a blocked app
  if (!state.isBlockedApp && state.sourceApp) {
    try {
      const pasteResult = await applyTextToApp(state.improvedText, state.sourceApp);
      result = {
        success: pasteResult.success,
        fallback: pasteResult.fallback,
        message: pasteResult.message,
      };
    } catch (error) {
      console.error('[GhostBar] Auto-paste failed:', error);
      result = {
        success: false,
        fallback: 'clipboard',
        message: 'Auto-paste failed. Press Cmd+V to paste manually.',
      };
    }
  } else {
    result = {
      success: true,
      fallback: 'clipboard',
      message: state.isBlockedApp
        ? 'Copied to clipboard. Press Cmd+V to paste.'
        : 'Copied to clipboard.',
    };
  }

  // Notify callback
  onApplyCallback?.(state);

  // Hide Ghost Bar
  hideGhostBar();

  return result;
}

/**
 * Handle expand action - open full analysis window
 */
function handleExpand(): void {
  if (!currentState) {
    return;
  }

  const state = currentState;

  // Notify callback to open main window
  onExpandCallback?.(state);

  // Hide Ghost Bar
  hideGhostBar();

  console.log('[GhostBar] Expand triggered');
}

/**
 * Start auto-dismiss timeout
 */
function startDismissTimeout(timeout: number): void {
  clearDismissTimeout();
  // 최소 5초, 최대 30초
  const effectiveTimeout = Math.max(5000, Math.min(timeout || 5000, 30000));
  console.log(`[GhostBar] Setting dismiss timeout: ${effectiveTimeout}ms (requested: ${timeout}ms)`);
  dismissTimeout = setTimeout(() => {
    console.log('[GhostBar] Auto-dismiss triggered');
    hideGhostBar();
  }, effectiveTimeout);
}

/**
 * Clear auto-dismiss timeout
 */
function clearDismissTimeout(): void {
  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }
}

/**
 * Reset dismiss timeout (e.g., on user interaction)
 */
export function resetDismissTimeout(timeout: number): void {
  startDismissTimeout(timeout);
}

/**
 * Set callback for expand action
 */
export function setOnExpandCallback(callback: (state: GhostBarState) => void): void {
  onExpandCallback = callback;
}

/**
 * Set callback for apply action
 */
export function setOnApplyCallback(callback: (state: GhostBarState) => void): void {
  onApplyCallback = callback;
}

/**
 * Register IPC handlers for Ghost Bar
 */
export function registerGhostBarHandlers(): void {
  // Handle apply button click from renderer
  ipcMain.handle('ghost-bar:apply', async () => {
    console.log('[GhostBar] IPC: Apply requested');
    return handleApply();
  });

  // Handle dismiss button click from renderer
  ipcMain.on('ghost-bar:dismiss', () => {
    console.log('[GhostBar] IPC: Dismiss requested');
    hideGhostBar();
  });

  // Handle expand button click from renderer
  ipcMain.on('ghost-bar:expand', () => {
    console.log('[GhostBar] IPC: Expand requested');
    handleExpand();
  });

  // Handle ready signal from renderer
  ipcMain.on('ghost-bar:ready', () => {
    console.log('[GhostBar] IPC: Renderer ready');
  });

  console.log('[GhostBar] IPC handlers registered');
}

/**
 * Generate HTML content for Ghost Bar
 */
function getGhostBarHTML(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 200px;
      height: 44px;
      background: transparent;
      overflow: hidden;
      -webkit-app-region: no-drag;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(30, 30, 30, 0.95);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.15s ease-out, transform 0.15s ease-out;
      pointer-events: auto;
    }

    .container.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .grade {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
    }

    .grade-badge {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }

    .grade-badge.low { background: #ef4444; }
    .grade-badge.mid { background: #f59e0b; }
    .grade-badge.high { background: #22c55e; }

    .arrow {
      color: #666;
      font-size: 12px;
    }

    .btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.1s, transform 0.1s;
    }

    .btn:active {
      transform: scale(0.95);
    }

    .btn-apply {
      background: #3b82f6;
      color: #fff;
      font-weight: 600;
    }

    .btn-apply:hover {
      background: #2563eb;
    }

    .btn-icon {
      background: transparent;
      color: #888;
      padding: 4px;
      font-size: 14px;
      min-width: 24px;
    }

    .btn-icon:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="container" id="container">
    <div class="grade">
      <span class="grade-badge low" id="original-grade">D</span>
      <span class="arrow">→</span>
      <span class="grade-badge high" id="improved-grade">A</span>
    </div>
    <button class="btn btn-apply" id="apply-btn">적용</button>
    <button class="btn btn-icon" id="more-btn" title="전체 분석 보기">⋯</button>
    <button class="btn btn-icon" id="close-btn" title="닫기">✕</button>
  </div>

  <script>
    const container = document.getElementById('container');
    const originalGradeEl = document.getElementById('original-grade');
    const improvedGradeEl = document.getElementById('improved-grade');
    const applyBtn = document.getElementById('apply-btn');
    const moreBtn = document.getElementById('more-btn');
    const closeBtn = document.getElementById('close-btn');

    // Update grade badge style based on grade
    function updateGradeBadgeStyle(element, grade) {
      element.classList.remove('low', 'mid', 'high');
      if (['D', 'F'].includes(grade)) {
        element.classList.add('low');
      } else if (['B', 'C'].includes(grade)) {
        element.classList.add('mid');
      } else {
        element.classList.add('high');
      }
    }

    // Listen for show event
    if (window.electronAPI && window.electronAPI.receive) {
      window.electronAPI.receive('ghost-bar:show', (data) => {
        originalGradeEl.textContent = data.originalGrade;
        improvedGradeEl.textContent = data.improvedGrade;
        updateGradeBadgeStyle(originalGradeEl, data.originalGrade);
        updateGradeBadgeStyle(improvedGradeEl, data.improvedGrade);
        container.classList.add('visible');
      });

      window.electronAPI.receive('ghost-bar:hide', () => {
        container.classList.remove('visible');
      });
    }

    // Button handlers
    applyBtn.addEventListener('click', () => {
      console.log('[GhostBar UI] Apply button clicked');
      if (window.electronAPI && window.electronAPI.invoke) {
        console.log('[GhostBar UI] Calling invoke ghost-bar:apply');
        window.electronAPI.invoke('ghost-bar:apply');
      } else {
        console.log('[GhostBar UI] electronAPI.invoke not available');
      }
    });

    moreBtn.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send('ghost-bar:expand');
      }
    });

    closeBtn.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send('ghost-bar:dismiss');
      }
    });

    // Signal ready
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('ghost-bar:ready');
    }
  </script>
</body>
</html>
`;
}

// Export for testing
export { ghostBarWindow, currentState };
