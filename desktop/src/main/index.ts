import { app, BrowserWindow, globalShortcut, clipboard, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { createTray, destroyTray } from './tray.js';
import { registerLearningEngineHandlers } from './learning-engine.js';
import { captureTextForAnalysis } from './text-selection.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Settings schema
interface AppSettings {
  shortcut: string;
  windowBounds: { width: number; height: number };
  alwaysOnTop: boolean;
  hideOnCopy: boolean;
  language: 'ko' | 'en';
  showNotifications: boolean;
}

// Initialize settings store
const store = new Store<AppSettings>({
  defaults: {
    shortcut: 'CommandOrControl+Shift+P',
    windowBounds: { width: 420, height: 600 },
    alwaysOnTop: true,
    hideOnCopy: false,
    language: 'ko',
    showNotifications: true,
  },
});

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// State tracking for improved hotkey behavior
let lastAnalyzedText = '';
let isRendererReady = false;
let pendingText: string | null = null;

/**
 * Send text to renderer for analysis.
 * If renderer is not ready, queue the text for later delivery.
 */
function sendTextToRenderer(text: string): void {
  if (isRendererReady && mainWindow) {
    mainWindow.webContents.send('clipboard-text', text);
  } else {
    pendingText = text;
    console.log('[Main] Renderer not ready, queuing text for later');
  }
}

function createWindow(): void {
  const { width, height } = store.get('windowBounds') as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 360,
    minHeight: 400,
    frame: false,  // Frameless for custom title bar
    transparent: false,  // Keep false - transparency causes visibility issues
    backgroundColor: '#0d1117',  // Match app background
    alwaysOnTop: store.get('alwaysOnTop') as boolean,
    skipTaskbar: true,  // Hide from dock (tray app)
    resizable: true,
    show: false,  // Show on ready-to-show
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Development: load from Vite dev server
  const devPort = process.env.VITE_PORT || '5173';
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load from built files
    const htmlPath = path.join(__dirname, '../renderer/index.html');
    console.log('[Main] Loading renderer from:', htmlPath);
    mainWindow.loadFile(htmlPath).catch((err) => {
      console.error('[Main] Failed to load renderer:', err);
    });
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready to show');
    mainWindow?.show();
  });

  // Handle renderer errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Renderer failed to load:', errorCode, errorDescription);
  });

  // Capture renderer console messages
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'log';
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`);
  });

  // Log when DOM is ready
  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Main] DOM ready');
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page finished loading');
  });

  // Reset renderer ready state on navigation/reload
  mainWindow.webContents.on('did-start-navigation', () => {
    isRendererReady = false;
    console.log('[Main] Navigation started, resetting renderer ready state');
  });

  // Force show after timeout as fallback
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('[Main] Force showing window after timeout');
      mainWindow.show();
    }
  }, 3000);

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', { width: bounds.width, height: bounds.height });
    }
  });

  // Hide instead of close (for quick access)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerShortcut(): void {
  const shortcut = store.get('shortcut') as string;

  globalShortcut.register(shortcut, async () => {
    if (!mainWindow) return;

    // Capture text (tries selection first, then clipboard)
    const { text: capturedText, source } = await captureTextForAnalysis();
    console.log(`[Main] Captured text from ${source}:`, capturedText?.substring(0, 50));

    if (mainWindow.isVisible()) {
      // Window is visible - decide: re-analyze or hide?
      if (capturedText && capturedText !== lastAnalyzedText) {
        // New text captured - re-analyze without hiding
        lastAnalyzedText = capturedText;
        sendTextToRenderer(capturedText);
        console.log('[Main] Re-analyzing new text while visible');
      } else {
        // Same text or no text - toggle hide
        mainWindow.hide();
        console.log('[Main] Hiding window (same text or no text)');
      }
    } else {
      // Window hidden - show and analyze
      if (capturedText) {
        lastAnalyzedText = capturedText;
        sendTextToRenderer(capturedText);
      }
      mainWindow.show();
      mainWindow.focus();
      console.log('[Main] Showing window and analyzing');
    }
  });
}

// IPC Handlers
ipcMain.handle('get-clipboard', () => {
  return clipboard.readText();
});

ipcMain.handle('set-clipboard', (_event, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('set-setting', (_event, key: string, value: unknown) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('hide-window', () => {
  mainWindow?.hide();
  return true;
});

ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize();
  return true;
});

// IPC Handler: Renderer ready signal (fixes race condition)
ipcMain.handle('renderer-ready', () => {
  isRendererReady = true;
  console.log('[Main] Renderer signaled ready');

  // Send any pending text that was queued before renderer was ready
  if (pendingText && mainWindow) {
    console.log('[Main] Sending pending text to renderer');
    mainWindow.webContents.send('clipboard-text', pendingText);
    pendingText = null;
  }

  return true;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  registerShortcut();

  // Create system tray
  if (mainWindow) {
    createTray(mainWindow);
  }

  // Register learning engine IPC handlers
  registerLearningEngineHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Only unregister shortcuts if app was fully ready
  if (app.isReady()) {
    globalShortcut.unregisterAll();
  }
  destroyTray();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
