/**
 * Settings Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { SettingsHandlerDeps } from '../settings-handlers.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

describe('Settings Handlers', () => {
  let deps: SettingsHandlerDeps;
  let mockStore: { get: Mock; set: Mock; store: Record<string, unknown> };
  let mockWindow: { webContents: { send: Mock }; isDestroyed: Mock };
  let mockGlobalShortcut: { unregister: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
      store: { language: 'auto', shortcut: 'CommandOrControl+Shift+P' },
    };

    mockWindow = {
      webContents: { send: vi.fn() },
      isDestroyed: vi.fn().mockReturnValue(false),
    };

    mockGlobalShortcut = {
      unregister: vi.fn(),
    };

    deps = {
      store: mockStore as unknown as SettingsHandlerDeps['store'],
      mainWindow: vi.fn().mockReturnValue(mockWindow),
      registerShortcut: vi.fn().mockReturnValue(true),
      initProjectPolling: vi.fn(),
      initClipboardWatch: vi.fn(),
      initAIContextPolling: vi.fn(),
      rebuildTrayMenu: vi.fn(),
      t: (key: string) => key,
      setLanguage: vi.fn(),
      getLanguageInfo: vi.fn().mockReturnValue({ language: 'en', source: 'auto' }),
      resolveLanguage: vi.fn().mockReturnValue('en'),
      getSystemLocale: vi.fn().mockReturnValue('en-US'),
      globalShortcut: mockGlobalShortcut as unknown as Electron.GlobalShortcut,
    };

    const { registerSettingsHandlers } = await import('../settings-handlers.js');
    registerSettingsHandlers(deps);
  });

  describe('get-settings', () => {
    it('should return all settings from store', async () => {
      const handler = mockIpcHandlers.get('get-settings');
      const result = await handler!();

      expect(result).toEqual(mockStore.store);
    });
  });

  describe('set-setting', () => {
    it('should save setting to store', async () => {
      const handler = mockIpcHandlers.get('set-setting');
      const result = await handler!(null, 'captureMode', 'auto');

      expect(mockStore.set).toHaveBeenCalledWith('captureMode', 'auto');
      expect(result).toEqual({ success: true });
    });

    it('should re-register shortcut when shortcut changed', async () => {
      mockStore.get.mockReturnValue('CommandOrControl+Shift+P');

      const handler = mockIpcHandlers.get('set-setting');
      const result = await handler!(null, 'shortcut', 'CommandOrControl+Shift+L');

      expect(mockStore.set).toHaveBeenCalledWith('shortcut', 'CommandOrControl+Shift+L');
      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+Shift+P');
      expect(deps.registerShortcut).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should send shortcut-failed event when registration fails', async () => {
      mockStore.get.mockReturnValue('CommandOrControl+Shift+P');
      (deps.registerShortcut as Mock).mockReturnValue(false);

      const handler = mockIpcHandlers.get('set-setting');
      const result = await handler!(null, 'shortcut', 'CommandOrControl+Shift+L');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('shortcut-failed', {
        shortcut: 'CommandOrControl+Shift+L',
        message: expect.stringContaining('shortcutFailed'),
      });
      expect(result).toEqual({ success: false });
    });

    it('should restart project polling when polling settings change', async () => {
      const handler = mockIpcHandlers.get('set-setting');
      await handler!(null, 'enableProjectPolling', true);

      expect(deps.initProjectPolling).toHaveBeenCalled();
    });

    it('should restart project polling when interval changes', async () => {
      const handler = mockIpcHandlers.get('set-setting');
      await handler!(null, 'pollingIntervalMs', 3000);

      expect(deps.initProjectPolling).toHaveBeenCalled();
    });

    it('should toggle clipboard watch when clipboard watch setting changes', async () => {
      const handler = mockIpcHandlers.get('set-setting');
      await handler!(null, 'enableClipboardWatch', true);

      expect(deps.initClipboardWatch).toHaveBeenCalled();
    });

    it('should toggle clipboard watch when ghost bar setting changes', async () => {
      const handler = mockIpcHandlers.get('set-setting');
      await handler!(null, 'ghostBar', { enabled: true });

      expect(deps.initClipboardWatch).toHaveBeenCalled();
    });

    it('should toggle AI context popup when setting changes', async () => {
      const handler = mockIpcHandlers.get('set-setting');
      await handler!(null, 'enableAIContextPopup', true);

      expect(deps.initAIContextPolling).toHaveBeenCalled();
    });

    it('should return error when set fails', async () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Store error');
      });

      const handler = mockIpcHandlers.get('set-setting');
      const result = await handler!(null, 'key', 'value');

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('saveError'),
      });
    });
  });

  describe('get-language', () => {
    it('should return language info from store', async () => {
      mockStore.get.mockReturnValue('ko');
      (deps.getLanguageInfo as Mock).mockReturnValue({ language: 'ko', source: 'user' });

      const handler = mockIpcHandlers.get('get-language');
      const result = await handler!();

      expect(mockStore.get).toHaveBeenCalledWith('language');
      expect(deps.getLanguageInfo).toHaveBeenCalledWith('ko');
      expect(result).toEqual({ language: 'ko', source: 'user' });
    });
  });

  describe('set-language', () => {
    it('should set language and notify renderer', async () => {
      (deps.resolveLanguage as Mock).mockReturnValue('ko');

      const handler = mockIpcHandlers.get('set-language');
      const result = await handler!(null, 'ko');

      expect(mockStore.set).toHaveBeenCalledWith('language', 'ko');
      expect(deps.setLanguage).toHaveBeenCalledWith('ko');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('language-changed', {
        language: 'ko',
        source: 'user',
      });
      expect(deps.rebuildTrayMenu).toHaveBeenCalled();
      expect(result).toEqual({ success: true, resolvedLanguage: 'ko' });
    });

    it('should handle auto language preference', async () => {
      (deps.resolveLanguage as Mock).mockReturnValue('en');

      const handler = mockIpcHandlers.get('set-language');
      const result = await handler!(null, 'auto');

      expect(mockStore.set).toHaveBeenCalledWith('language', 'auto');
      expect(deps.resolveLanguage).toHaveBeenCalledWith('auto', 'en-US');
      expect(result).toEqual({ success: true, resolvedLanguage: 'en' });
    });

    it('should reject invalid language code', async () => {
      const handler = mockIpcHandlers.get('set-language');
      const result = await handler!(null, 'invalid');

      expect(result).toEqual({ success: false, error: 'Invalid language code' });
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('should not crash when window is destroyed', async () => {
      mockWindow.isDestroyed.mockReturnValue(true);
      (deps.mainWindow as Mock).mockReturnValue(mockWindow);

      const handler = mockIpcHandlers.get('set-language');
      const result = await handler!(null, 'en');

      expect(result.success).toBe(true);
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should not crash when window is null', async () => {
      (deps.mainWindow as Mock).mockReturnValue(null);

      const handler = mockIpcHandlers.get('set-language');
      const result = await handler!(null, 'en');

      expect(result.success).toBe(true);
    });

    it('should return error when language change fails', async () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Language error');
      });

      const handler = mockIpcHandlers.get('set-language');
      const result = await handler!(null, 'ko');

      expect(result).toEqual({ success: false, error: 'Language error' });
    });
  });

  describe('IPC registration', () => {
    it('should register all settings handlers', () => {
      expect(mockIpcHandlers.has('get-settings')).toBe(true);
      expect(mockIpcHandlers.has('set-setting')).toBe(true);
      expect(mockIpcHandlers.has('get-language')).toBe(true);
      expect(mockIpcHandlers.has('set-language')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(4);
    });
  });
});
