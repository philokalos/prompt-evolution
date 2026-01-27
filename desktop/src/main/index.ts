import { app, BrowserWindow, globalShortcut, clipboard, screen, session, Notification, dialog } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { createTray, destroyTray, clearTrayBadge, setTrayBadge, rebuildTrayMenu } from './tray.js';
import { getClipboardWatcher, destroyClipboardWatcher, type DetectedPrompt } from './clipboard-watcher.js';
import { registerLearningEngineHandlers, analyzePrompt } from './learning-engine.js';
import {
  captureTextForAnalysis,
  checkAccessibilityPermission,
  showAccessibilityPermissionDialog,
  applyTextToApp,
  getFrontmostApp,
  isBlockedApp,
  type CaptureMode,
} from './text-selection.js';
import {
  startWindowPolling,
  stopWindowPolling,
  detectActiveProject,
  detectAllOpenProjects,
  getActiveWindowInfo,
  parseWindowTitle,
  startAIAppPolling,
  stopAIAppPolling,
  type DetectedProject,
  type DetectedAIApp,
} from './active-window-detector.js';
import { initAutoUpdater, cleanupAutoUpdater } from './auto-updater.js';
import { closeDatabase } from './db/connection.js';
import { saveAnalysis } from './db/history-crud.js';
import {
  showAIContextButton,
  hideAIContextButton,
  destroyAIContextButton,
  initAIContextPopupIPC,
} from './ai-context-popup.js';
import {
  createGhostBar,
  showGhostBar,
  hideGhostBar,
  destroyGhostBar,
  isGhostBarVisible,
  registerGhostBarHandlers,
  setOnExpandCallback,
  setOnApplyCallback,
} from './ghost-bar.js';
import {
  analyzeWithTimeout,
  cancelCurrentAnalysis,
  canBeImproved,
  createGhostBarState,
  getCachedAnalysis,
} from './ghost-bar-analysis.js';
import type { GhostBarSettings, GhostBarState } from './ghost-bar-types.js';
import {
  runAllMigrations,
} from './settings-migration.js';
import { validateProviderKey as validateProviderKeyFn } from './providers/provider-manager.js';
import {
  initMainI18n,
  setLanguage,
  getLanguageInfo,
  getSystemLocale,
  resolveLanguage,
  t,
  type UserLanguagePreference,
} from './i18n.js';
import {
  registerSettingsHandlers,
  registerClipboardHandlers,
  registerWindowHandlers,
  registerProjectHandlers,
  registerProviderHandlers,
} from './ipc/index.js';
import {
  store,
  getAIRewriteSettings,
  getAIProviders,
  setAIProviders,
  getPrimaryProviderConfig,
  hasAnyAIProvider,
} from './settings-store.js';
import {
  type CapturedContext,
  setLastCapturedContext as appStateSetLastCapturedContext,
} from './app-state.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable console.log in packaged production builds (keep electron-log for file logging)
// This prevents sensitive data from being logged and improves performance
if (app.isPackaged) {
  // Packaged app = production, suppress console output
  const noop = (): void => { /* no-op */ };
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  // Keep console.warn and console.error for critical issues
}

// Store imported from ./settings-store.js

/**
 * Show macOS notification if enabled in settings
 */
function showNotification(title: string, body: string): void {
  const showNotifications = store.get('showNotifications') as boolean;
  if (showNotifications) {
    const notification = new Notification({ title, body });
    notification.show();
  }
}

/**
 * Check if mainWindow is valid and not destroyed
 * Use this before any mainWindow operations to prevent crashes
 */
function isMainWindowValid(): boolean {
  return mainWindow !== null && !mainWindow.isDestroyed();
}

/**
 * Show welcome message on first launch
 */
async function showWelcomeMessage(): Promise<void> {
  // Check if user has already seen welcome message
  if (store.get('hasSeenWelcome')) {
    return;
  }

  // Detect system language
  const locale = app.getLocale();
  const isKorean = locale.startsWith('ko');

  // Localized welcome messages
  const messages = isKorean
    ? {
        title: 'PromptLint에 오신 것을 환영합니다!',
        message: 'AI 프롬프트 품질 향상 도우미',
        detail:
          '사용 방법:\n\n' +
          '1️⃣ 단축키: Cmd+Shift+P를 눌러 프롬프트 분석\n' +
          '   • 텍스트를 선택하고 단축키를 누르면 자동 캡처\n' +
          '   • 또는 클립보드에 복사 후 단축키 실행\n\n' +
          '2️⃣ GOLDEN 평가: 프롬프트의 6가지 핵심 요소 평가\n' +
          '   • Goal (목표), Output (출력), Limits (제약)\n' +
          '   • Data (데이터), Evaluation (평가), Next (다음 단계)\n\n' +
          '3️⃣ 개선 제안: 3가지 수준의 프롬프트 변형 제공\n' +
          '   • Conservative (보수적)\n' +
          '   • Balanced (균형적)\n' +
          '   • Comprehensive (포괄적)\n\n' +
          '4️⃣ AI 재작성 (선택): Claude API로 고품질 변형 생성\n' +
          '   • 설정에서 API 키 입력 후 활성화 가능\n\n' +
          '트레이 아이콘을 클릭하거나 단축키로 언제든지 실행하세요!',
        button: '시작하기',
      }
    : {
        title: 'Welcome to PromptLint!',
        message: 'AI Prompt Quality Assistant',
        detail:
          'How to use:\n\n' +
          '1️⃣ Hotkey: Press Cmd+Shift+P to analyze prompts\n' +
          '   • Select text and press hotkey for auto-capture\n' +
          '   • Or copy to clipboard first, then press hotkey\n\n' +
          '2️⃣ GOLDEN Evaluation: Assess 6 core elements\n' +
          '   • Goal, Output, Limits\n' +
          '   • Data, Evaluation, Next steps\n\n' +
          '3️⃣ Suggestions: Get 3 levels of prompt variants\n' +
          '   • Conservative\n' +
          '   • Balanced\n' +
          '   • Comprehensive\n\n' +
          '4️⃣ AI Rewrite (optional): Generate high-quality variants with Claude API\n' +
          '   • Enable in settings with your API key\n\n' +
          'Click the tray icon or use the hotkey anytime!',
        button: 'Get Started',
      };

  await dialog.showMessageBox({
    type: 'info',
    title: messages.title,
    message: messages.message,
    detail: messages.detail,
    buttons: [messages.button],
    defaultId: 0,
  });

  // Mark welcome as seen
  store.set('hasSeenWelcome', true);
}

// Re-export CapturedContext for backward compatibility
export type { CapturedContext };

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let showWindowTimeout: NodeJS.Timeout | null = null;

// Re-export settings functions for backward compatibility
export { getAIRewriteSettings, getAIProviders, setAIProviders, getPrimaryProviderConfig, hasAnyAIProvider };

// State tracking for improved hotkey behavior
let _lastAnalyzedText = '';
let isRendererReady = false;
let pendingText: { text: string; capturedContext: CapturedContext | null; isSourceAppBlocked: boolean } | null = null;
let currentProject: DetectedProject | null = null;
let lastFrontmostApp: string | null = null;
let lastCapturedContext: CapturedContext | null = null;
let selectedProjectPath: string | null = store.get('manualProjectPath') || null;

/**
 * Get the last captured context (for learning engine to use)
 */
export function getLastCapturedContext(): CapturedContext | null {
  return lastCapturedContext;
}

/**
 * Set captured context in both local and app-state (for learning engine)
 */
function setCapturedContext(ctx: CapturedContext | null): void {
  lastCapturedContext = ctx;
  appStateSetLastCapturedContext(ctx);
}

/**
 * Send text to renderer for analysis.
 * If renderer is not ready, queue the text for later delivery.
 * Includes captured context from hotkey time for accurate project detection.
 */
function sendTextToRenderer(text: string, capturedContext: CapturedContext | null = null): void {
  // Check if source app is blocked for Apply feature
  const sourceAppBlocked = isBlockedApp(lastFrontmostApp);
  const payload = { text, capturedContext, isSourceAppBlocked: sourceAppBlocked };

  if (isRendererReady && mainWindow) {
    console.log('[Main] Sending clipboard-text IPC with payload:', {
      textLength: text?.length,
      hasContext: !!capturedContext,
      project: capturedContext?.project?.projectPath,
      isSourceAppBlocked: sourceAppBlocked,
    });
    mainWindow.webContents.send('clipboard-text', payload);
    console.log('[Main] IPC sent successfully');
  } else {
    pendingText = payload;
    console.log('[Main] Renderer not ready, queuing text for later');
  }
}

/**
 * Empty state reason type
 */
type EmptyStateReason = 'blocked-app' | 'no-selection' | 'empty-clipboard';

/**
 * Send empty state notification to renderer.
 * Called when hotkey is pressed but no text is captured.
 * Shows contextual guidance to user based on reason.
 */
function sendEmptyStateToRenderer(
  reason: EmptyStateReason,
  appName: string | null,
  capturedContext: CapturedContext | null
): void {
  const payload = { reason, appName, capturedContext };

  if (isRendererReady && mainWindow) {
    console.log('[Main] Sending empty-state IPC with reason:', reason, 'app:', appName);
    mainWindow.webContents.send('empty-state', payload);
  } else {
    console.log('[Main] Renderer not ready, cannot send empty-state');
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
  // Reset state when creating a new window (prevents stale data from previous session)
  isRendererReady = false;
  pendingText = null;
  lastFrontmostApp = null;
  setCapturedContext(null);
  _lastAnalyzedText = '';

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
    console.log(`[Main] 📸 Screenshot mode: ${width}×${height} (will capture as ${width * 2}×${height * 2} on Retina)`);
  }

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

  // Deny all permission requests (camera, mic, geolocation, etc.) — this app doesn't need them
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
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
  showWindowTimeout = setTimeout(() => {
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
    if (!isQuitting && isMainWindowValid()) {
      event.preventDefault();
      mainWindow!.hide();
    }
  });

  mainWindow.on('closed', () => {
    // Clean up timeout to prevent memory leak
    if (showWindowTimeout) {
      clearTimeout(showWindowTimeout);
      showWindowTimeout = null;
    }
    mainWindow = null;
  });
}

function registerShortcut(): boolean {
  const shortcut = store.get('shortcut') as string;

  // Unregister existing shortcut first
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut);
  }

  const success = globalShortcut.register(shortcut, async () => {
    if (!mainWindow) return;

    // 1. Capture window context FIRST - before any other operations
    // This ensures we have the correct project even if user switches windows
    const windowInfo = await getActiveWindowInfo();
    const project = windowInfo?.isIDE ? parseWindowTitle(windowInfo) : null;

    setCapturedContext({
      windowInfo,
      project,
      timestamp: new Date(),
    });

    console.log(`[Main] Captured context: ${project?.projectPath || 'no project'} (IDE: ${windowInfo?.ideName || 'none'})`);

    // Save the frontmost app name for apply feature
    lastFrontmostApp = windowInfo?.appName || await getFrontmostApp();
    console.log(`[Main] Source app for apply: ${lastFrontmostApp}`);

    // Get capture mode from settings
    const captureMode = store.get('captureMode') as CaptureMode;

    // Capture text using configured mode
    const { text: capturedText, source } = await captureTextForAnalysis(captureMode);
    console.log(`[Main] Captured text from ${source} (mode: ${captureMode}):`, capturedText?.substring(0, 50));

    // No text captured - show empty state with contextual guidance
    if (!capturedText) {
      const sourceAppBlocked = isBlockedApp(lastFrontmostApp);
      const clipboardContent = clipboard.readText();

      // Determine the reason for empty state
      let reason: EmptyStateReason;
      if (sourceAppBlocked) {
        // Blocked app (VSCode, Antigravity, etc.) - clipboard fallback was used but empty
        reason = clipboardContent ? 'no-selection' : 'blocked-app';
      } else {
        // Normal app - no text was selected
        reason = 'no-selection';
      }

      console.log(`[Main] No text captured, showing empty state (reason: ${reason}, app: ${lastFrontmostApp})`);

      // Send empty state to renderer
      sendEmptyStateToRenderer(reason, lastFrontmostApp, lastCapturedContext);

      // Show window with guidance
      if (!mainWindow.isVisible()) {
        positionWindowNearCursor();
        mainWindow.showInactive();
        console.log('[Main] Showing window with empty state guidance');
      }
      return;
    }

    // Always analyze (even if same text)
    _lastAnalyzedText = capturedText;
    sendTextToRenderer(capturedText, lastCapturedContext);
    console.log('[Main] Analyzing text with captured context');

    // Show window if hidden (use showInactive to keep focus on source app)
    if (!mainWindow.isVisible()) {
      positionWindowNearCursor();
      mainWindow.showInactive();
      console.log('[Main] Showing window near cursor (without stealing focus)');
    }
  });

  if (success) {
    console.log(`[Main] ✅ Global shortcut registered: ${shortcut}`);
  } else {
    console.error(`[Main] ❌ Failed to register global shortcut: ${shortcut}`);
    console.error('[Main] Another app may be using this shortcut. Try changing it in Settings.');
  }

  return success;
}

/**
 * Analyze clipboard content immediately (for tray double-click)
 * Simpler flow: just read clipboard and analyze, no text selection
 */
async function analyzeClipboardNow(): Promise<void> {
  if (!mainWindow) return;

  const clipboardText = clipboard.readText();

  if (!clipboardText || clipboardText.trim().length < 10) {
    console.log('[Main] Clipboard empty or too short for analysis');
    return;
  }

  console.log('[Main] Double-click: analyzing clipboard content');

  // Clear any existing badge since user is actively checking
  clearTrayBadge();

  // Get current window info for context (but don't require it)
  const windowInfo = await getActiveWindowInfo();
  const project = windowInfo?.isIDE ? parseWindowTitle(windowInfo) : null;

  setCapturedContext({
    windowInfo,
    project,
    timestamp: new Date(),
  });

  lastFrontmostApp = windowInfo?.appName || null;
  _lastAnalyzedText = clipboardText;

  sendTextToRenderer(clipboardText, lastCapturedContext);

  // Show window near cursor (if auto-show is enabled)
  const autoShowWindow = store.get('autoShowWindow') as boolean;
  if (autoShowWindow !== false) { // Default to true if not set
    if (!mainWindow.isVisible()) {
      positionWindowNearCursor();
      mainWindow.showInactive();
      console.log('[Main] Showing analysis window (auto-show enabled)');
    } else {
      mainWindow.focus();
    }
  } else {
    console.log('[Main] Analysis started (auto-show disabled)');
  }
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

  // Notify renderer of project change (with safety checks)
  if (
    isRendererReady &&
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

/**
 * Initialize or update clipboard watching based on settings.
 * Clipboard watching is enabled if either:
 * - enableClipboardWatch is true, OR
 * - Ghost Bar is enabled (for seamless UX)
 */
function initClipboardWatch(): void {
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
    watcher.on('prompt-detected', async (detected: DetectedPrompt) => {
      console.log(`[Main] Clipboard prompt detected: "${detected.text.substring(0, 50)}..."`);

      // Show badge on tray icon
      setTrayBadge(true);

      // Check if Ghost Bar is enabled
      const ghostBarSettings = store.get('ghostBar') as GhostBarSettings;
      if (ghostBarSettings?.enabled) {
        console.log('[Main] Ghost Bar enabled, processing prompt');
        await handleGhostBarPrompt(detected);
        return; // Ghost Bar handles everything
      }

      // Check if auto-analyze is enabled
      const autoAnalyze = store.get('autoAnalyzeOnCopy') as boolean;
      if (autoAnalyze) {
        console.log('[Main] Auto-analyzing detected prompt');
        analyzeClipboardNow();
        return; // Skip notification if auto-analyzing
      }

      // Otherwise, show notification
      const showNotifications = store.get('showNotifications') as boolean;
      if (showNotifications && mainWindow) {
        // Send to renderer to show subtle notification
        mainWindow.webContents.send('prompt-detected', {
          text: detected.text,
          confidence: detected.confidence,
        });
      }
    });

    watcher.start();
    console.log('[Main] Clipboard watching enabled');
  } else {
    watcher.stop();
    clearTrayBadge();
    console.log('[Main] Clipboard watching disabled');
  }
}

/**
 * Initialize Ghost Bar callbacks for expand and apply actions
 */
function initGhostBarCallbacks(): void {
  // Handle expand action: open full analysis window with cached result
  setOnExpandCallback((state: GhostBarState) => {
    console.log('[Main] Ghost Bar expand triggered');

    // Get cached analysis result
    const cached = getCachedAnalysis(state.originalText);

    if (cached && isMainWindowValid()) {
      // Send cached result to main window
      mainWindow!.webContents.send('analysis-result', cached);
      // Show main window
      if (!mainWindow!.isVisible()) {
        positionWindowNearCursor();
        mainWindow!.showInactive();
      } else {
        mainWindow!.focus();
      }
    } else {
      // No cache, trigger new analysis
      sendTextToRenderer(state.originalText);
    }
  });

  // Handle apply action: save to history
  setOnApplyCallback((state: GhostBarState) => {
    console.log('[Main] Ghost Bar apply triggered');
    // Clear badge since prompt was processed
    clearTrayBadge();

    // T022: Save applied improvement to history
    try {
      const cached = getCachedAnalysis(state.originalText);
      if (cached) {
        saveAnalysis({
          promptText: state.originalText,
          overallScore: cached.overallScore,
          grade: cached.grade,
          goldenScores: cached.goldenScores,
          issues: cached.issues,
          improvedPrompt: state.improvedText,
          sourceApp: state.sourceApp ?? undefined,
        });
        console.log('[Main] Ghost Bar: Applied improvement saved to history');
      }
    } catch (error) {
      console.warn('[Main] Ghost Bar: Failed to save to history:', error);
    }
  });
}

/**
 * Handle prompt detection for Ghost Bar
 */
async function handleGhostBarPrompt(detected: DetectedPrompt): Promise<void> {
  const ghostBarSettings = store.get('ghostBar') as GhostBarSettings;

  // Check confidence threshold (use low value to catch more prompts)
  const effectiveThreshold = Math.min(ghostBarSettings.minimumConfidence, 0.1);
  if (detected.confidence < effectiveThreshold) {
    console.log(`[Main] Ghost Bar: Confidence ${detected.confidence} below threshold ${effectiveThreshold}`);
    return;
  }
  console.log(`[Main] Ghost Bar: Starting analysis`);

  // Cancel any previous analysis
  cancelCurrentAnalysis();

  // Get source app info
  let sourceApp: string | null = null;
  let blockedApp = false;
  try {
    sourceApp = await getFrontmostApp();
    blockedApp = sourceApp ? isBlockedApp(sourceApp) : false;
  } catch (error) {
    console.warn('[Main] Ghost Bar: Failed to get source app:', error);
  }

  // Analyze with timeout
  console.log('[Main] Ghost Bar: Starting analysis');
  const result = await analyzeWithTimeout(detected.text, analyzePrompt);

  if (!result) {
    console.log('[Main] Ghost Bar: Analysis failed or timed out');
    return;
  }

  // Check if improvement is possible (skip A-grade)
  if (!canBeImproved(result)) {
    console.log('[Main] Ghost Bar: Already A-grade, skipping');
    return;
  }

  // Create Ghost Bar state
  const state = createGhostBarState(detected.text, result, sourceApp, blockedApp);

  if (!state) {
    console.log('[Main] Ghost Bar: Failed to create state (no suitable variant)');
    return;
  }

  // Show Ghost Bar
  createGhostBar();
  showGhostBar(state, ghostBarSettings);
  console.log('[Main] Ghost Bar shown');

  // Also send result to main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    const payload = {
      text: detected.text,
      capturedContext: null,
      isSourceAppBlocked: blockedApp,
    };
    mainWindow.webContents.send('clipboard-text', payload);
    mainWindow.show();
    console.log('[Main] Ghost Bar: Also sent to main window');
  }
}

/**
 * Handle hotkey when Ghost Bar is visible
 * Close Ghost Bar and open full analysis window
 */
export function handleHotkeyWithGhostBar(): void {
  if (isGhostBarVisible()) {
    console.log('[Main] Hotkey pressed while Ghost Bar visible, opening full window');
    hideGhostBar();
    // Continue with normal hotkey behavior (analyze and show main window)
  }
}

/**
 * Handle AI app detection change.
 * Shows or hides the floating context button accordingly.
 */
function handleAIAppChange(aiApp: DetectedAIApp | null): void {
  if (aiApp) {
    console.log(`[Main] AI app detected: ${aiApp.aiAppType} (${aiApp.appName})`);

    // Show floating button
    showAIContextButton(() => {
      // On click: analyze clipboard content
      analyzeClipboardNow();
      // Hide the button after click
      hideAIContextButton();
    });
  } else {
    console.log('[Main] No AI app active, hiding button');
    hideAIContextButton();
  }
}

/**
 * Initialize or update AI context popup based on settings.
 */
function initAIContextPolling(): void {
  const enabled = store.get('enableAIContextPopup') as boolean;

  // Stop any existing polling
  stopAIAppPolling();

  if (enabled) {
    console.log('[Main] Starting AI app context polling');
    // Poll every 2 seconds to detect AI app focus
    startAIAppPolling(2000, handleAIAppChange);
  } else {
    console.log('[Main] AI context popup disabled');
    hideAIContextButton();
  }
}

// Register extracted IPC handlers
function registerExtractedHandlers(): void {
  registerSettingsHandlers({
    store: store as unknown as Store<Record<string, unknown>>,
    mainWindow: () => mainWindow,
    registerShortcut,
    initProjectPolling,
    initClipboardWatch,
    initAIContextPolling,
    rebuildTrayMenu,
    t,
    setLanguage,
    getLanguageInfo,
    resolveLanguage,
    getSystemLocale,
    globalShortcut,
  });

  registerClipboardHandlers({
    mainWindow: () => mainWindow,
    lastFrontmostApp: () => lastFrontmostApp,
    showNotification,
    applyTextToApp,
    isBlockedApp,
    t,
  });

  registerWindowHandlers({
    mainWindow: () => mainWindow,
    isMainWindowValid,
    getIsRendererReady: () => isRendererReady,
    setIsRendererReady: (ready: boolean) => { isRendererReady = ready; },
    getPendingText: () => pendingText,
    clearPendingText: () => { pendingText = null; },
    onRendererReady: () => {
      // Screenshot mode: Auto-inject test data using pendingText queue for safety
      const screenshotMode = process.env.SCREENSHOT_MODE === 'true';
      if (screenshotMode && mainWindow && !pendingText) {
        console.log('[Main] 📸 Screenshot mode: Preparing test prompt');
        const testPrompt = `Create a React component that displays user profile information with the following features:

1. Display user avatar image
2. Show user's full name and email address
3. Include a bio/description section with markdown support
4. Add social media links (Twitter, GitHub, LinkedIn)
5. Make the layout responsive for mobile and desktop
6. Use TypeScript for type safety
7. Style with Tailwind CSS
8. Ensure accessibility with proper ARIA labels
9. Add loading and error states
10. Include unit tests with React Testing Library

The component should follow React best practices and be reusable across the application.`;

        const mockContext: CapturedContext = {
          windowInfo: {
            appName: 'Code',
            windowTitle: 'UserProfile.tsx — my-app — Visual Studio Code',
            isIDE: true,
            ideName: 'Code',
          },
          project: {
            projectPath: '/Users/developer/projects/my-app',
            projectName: 'my-app',
            ideName: 'Code',
            currentFile: 'src/components/UserProfile.tsx',
            confidence: 'high',
          },
          timestamp: new Date(),
        };

        setCapturedContext(mockContext);
        sendTextToRenderer(testPrompt, mockContext);
        console.log('[Main] 📸 Test prompt queued for injection');
      }
    },
  });

  registerProjectHandlers({
    getCurrentProject: () => currentProject,
    setSelectedProjectPath: (p: string | null) => { selectedProjectPath = p; },
    getSelectedProjectPath: () => selectedProjectPath,
    detectActiveProject,
    detectAllOpenProjects,
    store: store as unknown as { get: (key: string) => unknown; set: (key: string, value: unknown) => void },
  });

  registerProviderHandlers({
    getAIProviders,
    setAIProviders,
    getPrimaryProviderConfig,
    hasAnyAIProvider,
    validateProviderKey: validateProviderKeyFn,
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Run all settings migrations before anything else
  runAllMigrations(store as unknown as Store<Record<string, unknown>>);

  // Initialize i18n for main process
  const languagePreference = store.get('language') as UserLanguagePreference;
  const resolvedLanguage = initMainI18n(languagePreference);
  console.log(`[Main] i18n initialized: preference=${languagePreference}, resolved=${resolvedLanguage}`);

  // Register extracted IPC handlers (settings, clipboard, window, project, provider)
  registerExtractedHandlers();

  createWindow();
  const shortcutRegistered = registerShortcut();

  // If primary shortcut failed, notify renderer after it's ready
  if (!shortcutRegistered) {
    const checkAndNotify = (): void => {
      if (isRendererReady && mainWindow) {
        const shortcut = store.get('shortcut') as string;
        mainWindow.webContents.send('shortcut-failed', {
          shortcut,
          message: t('errors:settings.shortcutFailedLong', { shortcut }),
        });
      } else {
        // Retry after renderer is ready
        setTimeout(checkAndNotify, 500);
      }
    };
    setTimeout(checkAndNotify, 1000);
  }

  // Create system tray with double-click handler for quick clipboard analysis
  if (mainWindow) {
    createTray(mainWindow, {
      onToggleWindow: () => {
        if (!isMainWindowValid()) return;
        if (mainWindow!.isVisible()) {
          mainWindow!.hide();
        } else {
          mainWindow!.show();
          mainWindow!.focus();
        }
      },
      onDoubleClick: () => {
        // Double-click: immediately analyze clipboard content
        analyzeClipboardNow();
      },
    });

    // Initialize auto-updater (GitHub Releases)
    initAutoUpdater(mainWindow);
  }

  // Register learning engine IPC handlers
  registerLearningEngineHandlers();

  // Initialize AI context popup IPC
  initAIContextPopupIPC();

  // Initialize Ghost Bar IPC handlers
  registerGhostBarHandlers();
  initGhostBarCallbacks();

  // Start project polling for active window detection
  initProjectPolling();

  // Initialize clipboard watching (if enabled in settings)
  initClipboardWatch();

  // Initialize AI context popup (if enabled in settings)
  initAIContextPolling();

  // Check accessibility permission for text selection capture
  // This is needed for AppleScript keyboard simulation (Cmd+C)
  const hasAccessibility = checkAccessibilityPermission(false);
  const hasSeenAccessibilityDialog = store.get('hasSeenAccessibilityDialog');

  // Only show dialog if:
  // 1. User hasn't seen it before
  // 2. Permission is not granted
  if (!hasAccessibility && !hasSeenAccessibilityDialog) {
    console.log('[Main] Accessibility permission not granted, showing dialog');
    // Delay to let the main window show first
    setTimeout(async () => {
      await showAccessibilityPermissionDialog();
      // Mark as seen so it won't show again
      store.set('hasSeenAccessibilityDialog', true);
    }, 2000);
  } else if (!hasAccessibility && hasSeenAccessibilityDialog) {
    console.log('[Main] Accessibility permission not granted, but user has already seen the dialog');
  }

  // Show welcome message on first launch
  setTimeout(async () => {
    await showWelcomeMessage();
  }, (hasAccessibility || hasSeenAccessibilityDialog) ? 2000 : 4000); // Show after accessibility dialog if needed

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (isMainWindowValid()) {
      mainWindow!.show();
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
  stopAIAppPolling();
  destroyClipboardWatcher();
  destroyAIContextButton();
  destroyGhostBar();
  destroyTray();
  cleanupAutoUpdater();
  closeDatabase();
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
