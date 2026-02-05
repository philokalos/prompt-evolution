/**
 * Main Window Module
 * Handles BrowserWindow creation, configuration, and lifecycle.
 */

import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type Store from 'electron-store';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Window configuration options
 */
export interface WindowConfig {
  store: Store<Record<string, unknown>>;
  onResize?: (bounds: { width: number; height: number }) => void;
  onClose?: () => boolean; // Return false to prevent close
  onClosed?: () => void;
  onReady?: () => void;
  onDOMReady?: () => void;
  onLoadError?: (errorCode: number, errorDescription: string) => void;
  onNavigationStart?: () => void;
}

/**
 * State for window management
 */
let mainWindow: BrowserWindow | null = null;
let showWindowTimeout: NodeJS.Timeout | null = null;

/**
 * Get the main window instance
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Check if mainWindow is valid and not destroyed
 */
export function isMainWindowValid(): boolean {
  return mainWindow !== null && !mainWindow.isDestroyed();
}

/**
 * Create the main application window
 *
 * @param config - Window configuration
 * @returns The created BrowserWindow
 */
export function createMainWindow(config: WindowConfig): BrowserWindow {
  const { store, onResize, onClose, onClosed, onReady, onDOMReady, onLoadError, onNavigationStart } = config;

  // Check for screenshot mode environment variables
  const screenshotMode = process.env.SCREENSHOT_MODE === 'true';
  const defaultBounds = store.get('windowBounds') as { width: number; height: number };

  // Use environment variables in screenshot mode, otherwise use stored settings
  const width = screenshotMode
    ? parseInt(process.env.WINDOW_WIDTH || '1440', 10)
    : defaultBounds.width;
  const height = screenshotMode
    ? parseInt(process.env.WINDOW_HEIGHT || '900', 10)
    : defaultBounds.height;

  if (screenshotMode) {
    console.log(`[Window] 📸 Screenshot mode: ${width}×${height} (will capture as ${width * 2}×${height * 2} on Retina)`);
  }

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 360,
    minHeight: 400,
    frame: false, // Frameless for custom title bar
    transparent: false, // Keep false - transparency causes visibility issues
    backgroundColor: '#0d1117', // Match app background
    alwaysOnTop: store.get('alwaysOnTop') as boolean,
    skipTaskbar: true, // Hide from dock (tray app)
    resizable: true,
    show: false, // Show on ready-to-show
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Production: tighten CSP by removing 'unsafe-eval' (needed only for Vite HMR in dev)
  if (process.env.NODE_ENV !== 'development') {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
          ],
        },
      });
    });
  }

  // Deny all permission requests (camera, mic, geolocation, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  // Load content
  const devPort = process.env.VITE_PORT || '5173';
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const htmlPath = path.join(__dirname, '../../renderer/index.html');
    console.log('[Window] Loading renderer from:', htmlPath);
    mainWindow.loadFile(htmlPath).catch((err) => {
      console.error('[Window] Failed to load renderer:', err);
    });
  }

  // Event: ready to show
  mainWindow.once('ready-to-show', () => {
    console.log('[Window] Ready to show');
    mainWindow?.show();
    onReady?.();
  });

  // Event: load error
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Window] Failed to load:', errorCode, errorDescription);
    onLoadError?.(errorCode, errorDescription);
  });

  // Event: console messages (for debugging)
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'log';
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`);
  });

  // Event: DOM ready
  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Window] DOM ready');
    onDOMReady?.();
  });

  // Event: page loaded
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] Page finished loading');
  });

  // Event: navigation start (reset ready state)
  mainWindow.webContents.on('did-start-navigation', () => {
    console.log('[Window] Navigation started');
    onNavigationStart?.();
  });

  // Force show after timeout as fallback
  showWindowTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('[Window] Force showing after timeout');
      mainWindow.show();
    }
  }, 3000);

  // Event: resize (save bounds)
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      onResize?.({ width: bounds.width, height: bounds.height });
    }
  });

  // Event: close (hide instead of close for quick access)
  mainWindow.on('close', (event) => {
    const shouldClose = onClose?.() ?? true;
    if (!shouldClose && isMainWindowValid()) {
      event.preventDefault();
      mainWindow!.hide();
    }
  });

  // Event: closed
  mainWindow.on('closed', () => {
    if (showWindowTimeout) {
      clearTimeout(showWindowTimeout);
      showWindowTimeout = null;
    }
    mainWindow = null;
    onClosed?.();
  });

  return mainWindow;
}

/**
 * Show the main window (create if needed)
 */
export function showMainWindow(): void {
  if (isMainWindowValid()) {
    mainWindow!.show();
    mainWindow!.focus();
  }
}

/**
 * Hide the main window
 */
export function hideMainWindow(): void {
  if (isMainWindowValid()) {
    mainWindow!.hide();
  }
}

/**
 * Toggle main window visibility
 */
export function toggleMainWindow(): void {
  if (!isMainWindowValid()) return;

  if (mainWindow!.isVisible()) {
    mainWindow!.hide();
  } else {
    mainWindow!.show();
    mainWindow!.focus();
  }
}

/**
 * Send message to renderer via IPC
 *
 * @param channel - IPC channel name
 * @param args - Arguments to send
 */
export function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (
    isMainWindowValid() &&
    mainWindow!.webContents &&
    !mainWindow!.webContents.isDestroyed()
  ) {
    try {
      mainWindow!.webContents.send(channel, ...args);
    } catch {
      // Window may have been closed during send - ignore
    }
  }
}

/**
 * Clean up window resources on app quit
 */
export function cleanupMainWindow(): void {
  if (showWindowTimeout) {
    clearTimeout(showWindowTimeout);
    showWindowTimeout = null;
  }
}
