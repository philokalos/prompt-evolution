/**
 * AI Context Popup - Floating button when AI apps are detected
 *
 * Shows a small floating button in the corner of the screen when
 * the user is working with AI apps (Claude, ChatGPT, etc.)
 * Clicking the button analyzes the current clipboard content.
 */

import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let floatingWindow: BrowserWindow | null = null;
let onClickCallback: (() => void) | null = null;

// Floating button configuration
const BUTTON_SIZE = 36; // Reduced from 48px to be less intrusive
const MARGIN = 20; // Increased margin to move further from screen edge

/**
 * Create and show the floating AI context button
 */
export function showAIContextButton(onClick: () => void): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    return;
  }

  onClickCallback = onClick;

  // Get primary display bounds
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  // Position in bottom-right corner
  const x = screenWidth - BUTTON_SIZE - MARGIN;
  const y = screenHeight - BUTTON_SIZE - MARGIN;

  floatingWindow = new BrowserWindow({
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: true,
    // Prevent window from accepting keyboard input
    acceptFirstMouse: false,
    // CRITICAL: Type 'panel' prevents the window from interfering with keyboard input
    type: 'panel',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
  });

  // CRITICAL FIX: Complete pass-through for all mouse/keyboard events EXCEPT button clicks
  // - setIgnoreMouseEvents(true) = window is completely transparent to mouse events
  // - { forward: true } = forward events to the window below
  // The HTML button re-enables pointer-events only on itself (CSS: pointer-events: auto)
  floatingWindow.setIgnoreMouseEvents(true, { forward: true });

  // Additional safeguard: Set window level to floating (lower than modal dialogs)
  // This prevents the window from blocking other apps' keyboard input
  if (process.platform === 'darwin') {
    // macOS-specific: Use floating window level (below screen saver, above normal)
    // This is lower than 'modal-panel' or 'status' level
    floatingWindow.setWindowButtonVisibility?.(false);
  }

  // Set window level to be always visible but not intrusive
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  // Load the floating button HTML
  const htmlContent = getFloatingButtonHTML();
  floatingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  // Store callback for IPC handler
  onClickCallback = onClick;

  console.log('[AIContext] Floating button shown');
}

/**
 * Hide the floating AI context button
 */
export function hideAIContextButton(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
    console.log('[AIContext] Floating button hidden');
  }
}

/**
 * Destroy the floating button window
 */
export function destroyAIContextButton(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.destroy();
    floatingWindow = null;
    console.log('[AIContext] Floating button destroyed');
  }
}

/**
 * Check if floating button is visible
 */
export function isAIContextButtonVisible(): boolean {
  return floatingWindow !== null && !floatingWindow.isDestroyed() && floatingWindow.isVisible();
}

/**
 * Generate the HTML content for the floating button
 */
function getFloatingButtonHTML(): string {
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
      width: 36px;
      height: 36px;
      background: transparent;
      overflow: hidden;
      -webkit-app-region: no-drag;
      /* Allow mouse events to pass through transparent areas */
      pointer-events: none;
    }

    .floating-button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      border: 2px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 3px 10px rgba(139, 92, 246, 0.3);
      /* Default: Semi-transparent to be less intrusive */
      opacity: 0.6;
      /* Re-enable mouse events for the button itself */
      pointer-events: auto;
    }

    .floating-button:hover {
      transform: scale(1.15);
      box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
      opacity: 1.0;
    }

    .floating-button:active {
      transform: scale(0.95);
    }

    .icon {
      width: 20px;
      height: 20px;
      color: white;
    }

    /* Subtle pulse animation - less distracting */
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 3px 10px rgba(139, 92, 246, 0.3);
      }
      50% {
        box-shadow: 0 3px 14px rgba(139, 92, 246, 0.5);
      }
    }

    .floating-button {
      animation: pulse 3s ease-in-out infinite; /* Slower: 3s instead of 2s */
    }

    .floating-button:hover {
      animation: none;
    }
  </style>
</head>
<body>
  <button class="floating-button" id="floatingBtn" title="PromptLint - 클립보드 분석">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>
      <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/>
      <path d="M19 11h2m-1 -1v2"/>
    </svg>
  </button>

  <script>
    const btn = document.getElementById('floatingBtn');
    btn.addEventListener('click', () => {
      // Send IPC message to main process
      if (window.electronAPI && window.electronAPI.send) {
        window.electronAPI.send('floating-button-click');
      } else {
        // Fallback: use postMessage
        window.postMessage({ type: 'floating-button-click' }, '*');
      }
    });
  </script>
</body>
</html>
`;
}

/**
 * Initialize IPC handler for floating button clicks
 */
export function initAIContextPopupIPC(): void {
  ipcMain.on('floating-button-click', () => {
    console.log('[AIContext] IPC: Floating button clicked');
    onClickCallback?.();
  });
}
