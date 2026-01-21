/**
 * Auto Updater Module
 * GitHub Releases based auto-update
 */

import pkg from 'electron-updater';
const { autoUpdater } = pkg;
type UpdateInfo = pkg.UpdateInfo;

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import electronLog from 'electron-log';
const log = electronLog.default ?? electronLog;
import { t } from './i18n.js';

// 로깅 설정
autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';

// 개발 모드에서는 업데이트 체크 비활성화
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Private repository 지원을 위한 GitHub Token 설정
// 환경변수 GH_TOKEN 또는 하드코딩된 토큰 사용
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (GH_TOKEN) {
  autoUpdater.requestHeaders = {
    Authorization: `token ${GH_TOKEN}`,
  };
  log.info('[AutoUpdater] GitHub token configured for private repo');
}

// 업데이트 상태
interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  version: string | null;
}

let updateStatus: UpdateStatus = {
  checking: false,
  available: false,
  downloaded: false,
  downloading: false,
  progress: 0,
  error: null,
  version: null,
};

let mainWindow: BrowserWindow | null = null;
let periodicCheckInterval: NodeJS.Timeout | null = null;
let initialCheckTimeout: NodeJS.Timeout | null = null;

/**
 * 렌더러에 상태 전송
 */
function sendStatusToRenderer(status: Partial<UpdateStatus>): void {
  updateStatus = { ...updateStatus, ...status };
  mainWindow?.webContents.send('update-status', updateStatus);
}

/**
 * 자동 업데이트 초기화
 */
export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // 개발 모드 체크
  if (!app.isPackaged) {
    log.info('[AutoUpdater] Development mode - auto-update disabled');
    return;
  }

  // 이벤트 핸들러 설정
  autoUpdater.on('checking-for-update', () => {
    log.info('[AutoUpdater] Checking for updates...');
    sendStatusToRenderer({ checking: true, error: null });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('[AutoUpdater] Update available:', info.version);
    sendStatusToRenderer({
      checking: false,
      available: true,
      version: info.version,
    });

    // Notify user
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: t('errors:update.availableTitle'),
      message: t('errors:update.availableMessage', { version: info.version }),
      detail: t('errors:update.availableDetail'),
      buttons: [t('errors:update.downloadButton'), t('errors:update.laterButton')],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[AutoUpdater] No updates available');
    sendStatusToRenderer({
      checking: false,
      available: false,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    sendStatusToRenderer({
      downloading: true,
      progress: progress.percent,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('[AutoUpdater] Update downloaded:', info.version);
    sendStatusToRenderer({
      downloading: false,
      downloaded: true,
      progress: 100,
    });

    // Installation guide
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: t('errors:update.readyTitle'),
      message: t('errors:update.readyMessage', { version: info.version }),
      detail: t('errors:update.readyDetail'),
      buttons: [t('errors:update.restartNowButton'), t('errors:update.laterButton')],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('[AutoUpdater] Error:', error);

    // User-friendly error messages by type
    let userMessage = error.message;

    if (error.message.includes('404')) {
      userMessage = t('errors:update.noRelease');
      log.info('[AutoUpdater] No GitHub release found - this is expected if releases are not published');
    } else if (error.message.includes('net::ERR_FAILED') || error.message.includes('ENOTFOUND')) {
      userMessage = t('errors:update.networkError');
    } else if (error.message.includes('401') || error.message.includes('403')) {
      userMessage = t('errors:update.authError');
    }

    sendStatusToRenderer({
      checking: false,
      downloading: false,
      error: userMessage,
    });
  });

  // IPC 핸들러
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
      return { available: false, message: 'Development mode' };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        available: result?.updateInfo != null,
        version: result?.updateInfo?.version,
      };
    } catch (error) {
      log.error('[AutoUpdater] Check failed:', error);
      return { available: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-update-status', () => {
    return updateStatus;
  });

  // Note: 'get-app-version' is already registered in index.ts

  // 앱 시작 시 업데이트 체크 (5초 후)
  initialCheckTimeout = setTimeout(() => {
    log.info('[AutoUpdater] Initial update check');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[AutoUpdater] Initial check failed:', err);
    });
    initialCheckTimeout = null;
  }, 5000);

  // 주기적 업데이트 체크 (1시간마다)
  periodicCheckInterval = setInterval(() => {
    log.info('[AutoUpdater] Periodic update check');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[AutoUpdater] Periodic check failed:', err);
    });
  }, 60 * 60 * 1000);
}

/**
 * 수동 업데이트 체크
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!app.isPackaged) {
    log.info('[AutoUpdater] Skipping update check in development mode');
    return false;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo != null;
  } catch (error) {
    log.error('[AutoUpdater] Manual check failed:', error);
    return false;
  }
}

/**
 * 타이머 정리 (앱 종료 시 호출)
 */
export function cleanupAutoUpdater(): void {
  if (initialCheckTimeout) {
    clearTimeout(initialCheckTimeout);
    initialCheckTimeout = null;
  }
  if (periodicCheckInterval) {
    clearInterval(periodicCheckInterval);
    periodicCheckInterval = null;
  }
  mainWindow = null;
  log.info('[AutoUpdater] Cleanup completed');
}
