/**
 * Auto Updater Module
 * GitHub Releases 기반 자동 업데이트
 */

import pkg from 'electron-updater';
const { autoUpdater } = pkg;
type UpdateInfo = pkg.UpdateInfo;

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import electronLog from 'electron-log';
const log = electronLog.default ?? electronLog;

// 로깅 설정
autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';

// 개발 모드에서는 업데이트 체크 비활성화
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

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

    // 사용자에게 알림
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 가능',
      message: `새 버전 ${info.version}이 있습니다.`,
      detail: '지금 다운로드하시겠습니까?',
      buttons: ['다운로드', '나중에'],
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

    // 설치 안내
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `버전 ${info.version} 다운로드 완료`,
      detail: '앱을 재시작하면 업데이트가 설치됩니다.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('[AutoUpdater] Error:', error);
    sendStatusToRenderer({
      checking: false,
      downloading: false,
      error: error.message,
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

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // 앱 시작 시 업데이트 체크 (5초 후)
  setTimeout(() => {
    log.info('[AutoUpdater] Initial update check');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[AutoUpdater] Initial check failed:', err);
    });
  }, 5000);

  // 주기적 업데이트 체크 (1시간마다)
  setInterval(() => {
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
