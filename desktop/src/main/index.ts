import { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { createTray, destroyTray } from './tray.js';
import { registerLearningEngineHandlers } from './learning-engine.js';
import {
  captureTextForAnalysis,
  checkAccessibilityPermission,
  showAccessibilityPermissionDialog,
  type CaptureMode,
} from './text-selection.js';
import {
  startWindowPolling,
  stopWindowPolling,
  detectActiveProject,
  type DetectedProject,
} from './active-window-detector.js';
import { initAutoUpdater } from './auto-updater.js';

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
  captureMode: 'auto' | 'selection' | 'clipboard';
  enableProjectPolling: boolean;
  pollingIntervalMs: number;
  claudeApiKey: string;
  useAiRewrite: boolean;
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
    captureMode: 'auto',
    enableProjectPolling: true,
    pollingIntervalMs: 2000,
    claudeApiKey: '',
    useAiRewrite: false,
  },
});

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

/**
 * Get AI rewrite settings for use by learning engine
 */
export function getAIRewriteSettings(): { apiKey: string; enabled: boolean } {
  return {
    apiKey: store.get('claudeApiKey') || '',
    enabled: store.get('useAiRewrite') || false,
  };
}

// State tracking for improved hotkey behavior
let lastAnalyzedText = '';
let isRendererReady = false;
let pendingText: string | null = null;
let currentProject: DetectedProject | null = null;

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

/**
 * Position the window near the mouse cursor.
 * Places window to the right of cursor, or left if not enough space.
 * Handles multi-monitor setups correctly.
 */
function positionWindowNearCursor(): void {
  if (!mainWindow) return;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { width: screenW, height: screenH } = display.workAreaSize;
  const { x: screenX, y: screenY } = display.workArea;
  const [winW, winH] = mainWindow.getSize();

  // Position to the right of cursor (20px gap)
  let x = cursor.x + 20;
  let y = cursor.y - Math.floor(winH / 2); // Vertical center alignment

  // If overflows right edge, position to the left
  if (x + winW > screenX + screenW) {
    x = cursor.x - winW - 20;
  }

  // Clamp to screen bounds
  if (y < screenY) y = screenY + 10;
  if (y + winH > screenY + screenH) y = screenY + screenH - winH - 10;

  mainWindow.setPosition(x, y);
  console.log(`[Main] Positioned window at ${x}, ${y} (cursor: ${cursor.x}, ${cursor.y})`);
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

    // Get capture mode from settings
    const captureMode = store.get('captureMode') as CaptureMode;

    // Capture text using configured mode
    const { text: capturedText, source } = await captureTextForAnalysis(captureMode);
    console.log(`[Main] Captured text from ${source} (mode: ${captureMode}):`, capturedText?.substring(0, 50));

    // No text captured - do nothing
    if (!capturedText) {
      console.log('[Main] No text captured, ignoring');
      return;
    }

    // Always analyze (even if same text)
    lastAnalyzedText = capturedText;
    sendTextToRenderer(capturedText);
    console.log('[Main] Analyzing text');

    // Show window if hidden (use showInactive to keep focus on source app)
    if (!mainWindow.isVisible()) {
      positionWindowNearCursor();
      mainWindow.showInactive();
      console.log('[Main] Showing window near cursor (without stealing focus)');
    }
  });
}

/**
 * Handle project change detected by polling.
 * Sends notification to renderer when active project changes.
 */
function handleProjectChange(project: DetectedProject | null): void {
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

  // Notify renderer of project change
  if (isRendererReady && mainWindow) {
    mainWindow.webContents.send('project-changed', project);
  }
}

/**
 * Start or restart project polling based on settings.
 */
function initProjectPolling(): void {
  const enabled = store.get('enableProjectPolling') as boolean;
  const interval = store.get('pollingIntervalMs') as number;

  // Stop any existing polling
  stopWindowPolling();

  if (enabled) {
    console.log(`[Main] Starting project polling (interval: ${interval}ms)`);
    startWindowPolling(interval, handleProjectChange);
  } else {
    console.log('[Main] Project polling disabled');
  }
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

  // Restart polling if polling settings changed
  if (key === 'enableProjectPolling' || key === 'pollingIntervalMs') {
    initProjectPolling();
  }

  return true;
});

// IPC Handler: Get current detected project
ipcMain.handle('get-current-project', async () => {
  // Return cached project or detect fresh
  if (currentProject) {
    return currentProject;
  }
  return await detectActiveProject();
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
app.whenReady().then(async () => {
  createWindow();
  registerShortcut();

  // Create system tray
  if (mainWindow) {
    createTray(mainWindow);

    // Initialize auto-updater (GitHub Releases)
    initAutoUpdater(mainWindow);
  }

  // Register learning engine IPC handlers
  registerLearningEngineHandlers();

  // Start project polling for active window detection
  initProjectPolling();

  // Check accessibility permission for text selection capture
  // This is needed for AppleScript keyboard simulation (Cmd+C)
  const hasAccessibility = checkAccessibilityPermission(false);
  if (!hasAccessibility) {
    console.log('[Main] Accessibility permission not granted, showing dialog');
    // Delay to let the main window show first
    setTimeout(async () => {
      await showAccessibilityPermissionDialog();
    }, 2000);
  }

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
  stopWindowPolling();
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
