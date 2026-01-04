/**
 * Tests for auto-updater.ts
 * PromptLint - GitHub Releases 기반 자동 업데이트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock state
const mockState = vi.hoisted(() => ({
  isPackaged: false,
  appVersion: '1.0.0',
  checkForUpdatesResult: null as { updateInfo?: { version: string } } | null,
  downloadUpdateSuccess: true,
  mainWindowWebContents: {
    send: vi.fn(),
  },
  dialogResponse: 0,
  updateError: null as Error | null,
  eventHandlers: {} as Record<string, (...args: unknown[]) => void>,
  ipcHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
}));

// Mock electron-updater
vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: {
      logger: null,
      autoDownload: false,
      autoInstallOnAppQuit: true,
      requestHeaders: {},
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        mockState.eventHandlers[event] = handler;
      }),
      checkForUpdates: vi.fn(() => {
        if (mockState.updateError) {
          return Promise.reject(mockState.updateError);
        }
        return Promise.resolve(mockState.checkForUpdatesResult);
      }),
      downloadUpdate: vi.fn(() => {
        if (mockState.downloadUpdateSuccess) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Download failed'));
      }),
      quitAndInstall: vi.fn(),
    },
  },
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: (() => mockState.isPackaged) as unknown as boolean,
    getVersion: () => mockState.appVersion,
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: mockState.dialogResponse })),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockState.ipcHandlers[channel] = handler;
    }),
  },
}));

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    transports: {
      file: { level: 'info' },
    },
  },
}));

// Import after mocking
import { initAutoUpdater, checkForUpdates } from '../auto-updater.js';
import { app, dialog } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

// Create mock window
function createMockWindow(): Electron.BrowserWindow {
  return {
    webContents: mockState.mainWindowWebContents,
  } as unknown as Electron.BrowserWindow;
}

describe('auto-updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.isPackaged = false;
    mockState.appVersion = '1.0.0';
    mockState.checkForUpdatesResult = null;
    mockState.downloadUpdateSuccess = true;
    mockState.dialogResponse = 0;
    mockState.updateError = null;
    mockState.eventHandlers = {};
    mockState.ipcHandlers = {};

    // Reset app.isPackaged mock
    Object.defineProperty(app, 'isPackaged', {
      get: () => mockState.isPackaged,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initAutoUpdater', () => {
    it('should skip initialization in development mode', () => {
      mockState.isPackaged = false;
      const mockWindow = createMockWindow();

      initAutoUpdater(mockWindow);

      expect(autoUpdater.on).not.toHaveBeenCalled();
    });

    it('should set up event handlers in production mode', () => {
      mockState.isPackaged = true;
      const mockWindow = createMockWindow();

      initAutoUpdater(mockWindow);

      expect(autoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should register IPC handlers in production mode', () => {
      mockState.isPackaged = true;
      const mockWindow = createMockWindow();

      initAutoUpdater(mockWindow);

      // Check that IPC handlers were registered via mockState
      expect(mockState.ipcHandlers['check-for-updates']).toBeDefined();
      expect(mockState.ipcHandlers['download-update']).toBeDefined();
      expect(mockState.ipcHandlers['install-update']).toBeDefined();
      expect(mockState.ipcHandlers['get-update-status']).toBeDefined();
      expect(mockState.ipcHandlers['get-app-version']).toBeDefined();
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      mockState.isPackaged = true;
      const mockWindow = createMockWindow();
      initAutoUpdater(mockWindow);
    });

    it('should handle checking-for-update event', () => {
      const handler = mockState.eventHandlers['checking-for-update'];
      expect(handler).toBeDefined();

      handler();

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({ checking: true, error: null })
      );
    });

    it('should handle update-available event', () => {
      const handler = mockState.eventHandlers['update-available'];
      expect(handler).toBeDefined();

      handler({ version: '2.0.0' });

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          checking: false,
          available: true,
          version: '2.0.0',
        })
      );
      expect(dialog.showMessageBox).toHaveBeenCalled();
    });

    it('should download update when user confirms', async () => {
      mockState.dialogResponse = 0; // User clicks "다운로드"
      const handler = mockState.eventHandlers['update-available'];

      handler({ version: '2.0.0' });

      // Wait for dialog promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
    });

    it('should not download update when user declines', async () => {
      mockState.dialogResponse = 1; // User clicks "나중에"
      const handler = mockState.eventHandlers['update-available'];

      handler({ version: '2.0.0' });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    });

    it('should handle update-not-available event', () => {
      const handler = mockState.eventHandlers['update-not-available'];
      expect(handler).toBeDefined();

      handler();

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          checking: false,
          available: false,
        })
      );
    });

    it('should handle download-progress event', () => {
      const handler = mockState.eventHandlers['download-progress'];
      expect(handler).toBeDefined();

      handler({ percent: 50.5 });

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          downloading: true,
          progress: 50.5,
        })
      );
    });

    it('should handle update-downloaded event', () => {
      const handler = mockState.eventHandlers['update-downloaded'];
      expect(handler).toBeDefined();

      handler({ version: '2.0.0' });

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          downloading: false,
          downloaded: true,
          progress: 100,
        })
      );
      expect(dialog.showMessageBox).toHaveBeenCalled();
    });

    it('should quit and install when user confirms restart', async () => {
      mockState.dialogResponse = 0; // User clicks "지금 재시작"
      const handler = mockState.eventHandlers['update-downloaded'];

      handler({ version: '2.0.0' });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    });

    it('should not quit and install when user declines restart', async () => {
      mockState.dialogResponse = 1; // User clicks "나중에"
      const handler = mockState.eventHandlers['update-downloaded'];

      handler({ version: '2.0.0' });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    });

    it('should handle error event with 404 message', () => {
      const handler = mockState.eventHandlers['error'];
      expect(handler).toBeDefined();

      handler(new Error('404 Not Found'));

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          checking: false,
          downloading: false,
          error: expect.stringContaining('릴리스가 없습니다'),
        })
      );
    });

    it('should handle error event with network error', () => {
      const handler = mockState.eventHandlers['error'];

      handler(new Error('net::ERR_FAILED'));

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          error: expect.stringContaining('네트워크 연결'),
        })
      );
    });

    it('should handle error event with auth error', () => {
      const handler = mockState.eventHandlers['error'];

      handler(new Error('401 Unauthorized'));

      expect(mockState.mainWindowWebContents.send).toHaveBeenCalledWith(
        'update-status',
        expect.objectContaining({
          error: expect.stringContaining('GitHub 접근 권한'),
        })
      );
    });
  });

  describe('IPC handlers', () => {
    beforeEach(() => {
      mockState.isPackaged = true;
      const mockWindow = createMockWindow();
      initAutoUpdater(mockWindow);
    });

    it('should handle check-for-updates in development mode', async () => {
      mockState.isPackaged = false;
      Object.defineProperty(app, 'isPackaged', {
        get: () => false,
        configurable: true,
      });

      const handler = mockState.ipcHandlers['check-for-updates'];
      const result = await handler();

      expect(result).toEqual({ available: false, message: 'Development mode' });
    });

    it('should handle check-for-updates with update available', async () => {
      mockState.checkForUpdatesResult = { updateInfo: { version: '2.0.0' } };
      Object.defineProperty(app, 'isPackaged', {
        get: () => true,
        configurable: true,
      });

      const handler = mockState.ipcHandlers['check-for-updates'];
      const result = await handler();

      expect(result).toEqual({
        available: true,
        version: '2.0.0',
      });
    });

    it('should handle check-for-updates with no update', async () => {
      mockState.checkForUpdatesResult = null;
      Object.defineProperty(app, 'isPackaged', {
        get: () => true,
        configurable: true,
      });

      const handler = mockState.ipcHandlers['check-for-updates'];
      const result = await handler();

      expect(result).toEqual({
        available: false,
        version: undefined,
      });
    });

    it('should handle check-for-updates error', async () => {
      mockState.updateError = new Error('Check failed');
      Object.defineProperty(app, 'isPackaged', {
        get: () => true,
        configurable: true,
      });

      const handler = mockState.ipcHandlers['check-for-updates'];
      const result = await handler();

      expect(result).toEqual({
        available: false,
        error: 'Check failed',
      });
    });

    it('should handle download-update success', async () => {
      mockState.downloadUpdateSuccess = true;

      const handler = mockState.ipcHandlers['download-update'];
      const result = await handler();

      expect(result).toEqual({ success: true });
    });

    it('should handle download-update failure', async () => {
      mockState.downloadUpdateSuccess = false;

      const handler = mockState.ipcHandlers['download-update'];
      const result = await handler();

      expect(result).toEqual({
        success: false,
        error: 'Download failed',
      });
    });

    it('should handle install-update', () => {
      const handler = mockState.ipcHandlers['install-update'];
      handler();

      expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    });

    it('should handle get-update-status', () => {
      const handler = mockState.ipcHandlers['get-update-status'];
      const result = handler();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('checking');
      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('downloaded');
    });

    it('should handle get-app-version', () => {
      const handler = mockState.ipcHandlers['get-app-version'];
      const result = handler();

      expect(result).toBe('1.0.0');
    });
  });

  describe('checkForUpdates', () => {
    it('should return false in development mode', async () => {
      mockState.isPackaged = false;
      Object.defineProperty(app, 'isPackaged', {
        get: () => false,
        configurable: true,
      });

      const result = await checkForUpdates();

      expect(result).toBe(false);
    });

    it('should return true when update is available', async () => {
      mockState.isPackaged = true;
      mockState.checkForUpdatesResult = { updateInfo: { version: '2.0.0' } };
      Object.defineProperty(app, 'isPackaged', {
        get: () => true,
        configurable: true,
      });

      const result = await checkForUpdates();

      expect(result).toBe(true);
    });

    it('should return false when no update is available', async () => {
      mockState.isPackaged = true;
      mockState.checkForUpdatesResult = null;
      Object.defineProperty(app, 'isPackaged', {
        get: () => true,
        configurable: true,
      });

      const result = await checkForUpdates();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockState.isPackaged = true;
      mockState.updateError = new Error('Check failed');
      Object.defineProperty(app, 'isPackaged', {
        get: () => true,
        configurable: true,
      });

      const result = await checkForUpdates();

      expect(result).toBe(false);
    });
  });
});
