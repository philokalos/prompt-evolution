/**
 * App Lifecycle Module
 * Handles Electron app lifecycle events and initialization
 */

import { app, globalShortcut, Notification, dialog } from 'electron';
import { store } from '../settings-store.js';

/**
 * Application state tracking
 */
let isQuitting = false;

/**
 * Check if app is in quitting state
 */
export function isAppQuitting(): boolean {
  return isQuitting;
}

/**
 * Set app quitting state
 */
export function setAppQuitting(value: boolean): void {
  isQuitting = value;
}

/**
 * Show macOS notification if enabled in settings
 */
export function showNotification(title: string, body: string): void {
  const showNotifications = store.get('showNotifications') as boolean;
  if (showNotifications) {
    const notification = new Notification({ title, body });
    notification.show();
  }
}

/**
 * Show welcome message on first launch
 */
export async function showWelcomeMessage(): Promise<void> {
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

/**
 * Cleanup dependencies for app lifecycle
 */
export interface CleanupDeps {
  stopWindowPolling: () => void;
  stopAIAppPolling: () => void;
  destroyClipboardWatcher: () => void;
  destroyAIContextButton: () => void;
  destroyGhostBar: () => void;
  destroyTray: () => void;
  cleanupAutoUpdater: () => void;
  closeDatabase: () => void;
}

/**
 * Register app lifecycle event handlers
 */
export function registerLifecycleHandlers(deps: CleanupDeps): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    setAppQuitting(true);
  });

  app.on('will-quit', () => {
    // Only unregister shortcuts if app was fully ready
    if (app.isReady()) {
      globalShortcut.unregisterAll();
    }
    deps.stopWindowPolling();
    deps.stopAIAppPolling();
    deps.destroyClipboardWatcher();
    deps.destroyAIContextButton();
    deps.destroyGhostBar();
    deps.destroyTray();
    deps.cleanupAutoUpdater();
    deps.closeDatabase();
  });
}

/**
 * Prevent multiple instances of the app
 */
export function setupSingleInstance(onSecondInstance: () => void): boolean {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', onSecondInstance);
  return true;
}
