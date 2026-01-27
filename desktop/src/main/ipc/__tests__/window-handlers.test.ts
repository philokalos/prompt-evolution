/**
 * Window Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { WindowHandlerDeps } from '../window-handlers.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockShell = { openExternal: vi.fn() };

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn().mockReturnValue('0.1.10'),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
  shell: mockShell,
}));

describe('Window Handlers', () => {
  let deps: WindowHandlerDeps;
  let mockWindow: { hide: Mock; minimize: Mock; webContents: { send: Mock } };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    mockWindow = {
      hide: vi.fn(),
      minimize: vi.fn(),
      webContents: { send: vi.fn() },
    };

    deps = {
      mainWindow: vi.fn().mockReturnValue(mockWindow),
      isMainWindowValid: vi.fn().mockReturnValue(true),
      getIsRendererReady: vi.fn().mockReturnValue(false),
      setIsRendererReady: vi.fn(),
      getPendingText: vi.fn().mockReturnValue(null),
      clearPendingText: vi.fn(),
      onRendererReady: vi.fn(),
    };

    const { registerWindowHandlers } = await import('../window-handlers.js');
    registerWindowHandlers(deps);
  });

  describe('get-app-version', () => {
    it('should return app version', async () => {
      const handler = mockIpcHandlers.get('get-app-version');
      const result = await handler!();

      expect(result).toBe('0.1.10');
    });
  });

  describe('hide-window', () => {
    it('should hide window when window is valid', async () => {
      const handler = mockIpcHandlers.get('hide-window');
      const result = await handler!();

      expect(mockWindow.hide).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not hide when window is invalid', async () => {
      (deps.isMainWindowValid as Mock).mockReturnValue(false);

      const handler = mockIpcHandlers.get('hide-window');
      const result = await handler!();

      expect(mockWindow.hide).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('minimize-window', () => {
    it('should minimize window', async () => {
      const handler = mockIpcHandlers.get('minimize-window');
      const result = await handler!();

      expect(mockWindow.minimize).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle null window gracefully', async () => {
      (deps.mainWindow as Mock).mockReturnValue(null);

      const handler = mockIpcHandlers.get('minimize-window');
      const result = await handler!();

      expect(mockWindow.minimize).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('open-external', () => {
    beforeEach(() => {
      mockShell.openExternal.mockResolvedValue();
    });

    it('should open valid https URL', async () => {
      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 'https://example.com');

      expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com');
      expect(result).toEqual({ success: true });
    });

    it('should open valid http URL', async () => {
      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 'http://example.com');

      expect(mockShell.openExternal).toHaveBeenCalledWith('http://example.com');
      expect(result).toEqual({ success: true });
    });

    it('should reject non-string URL', async () => {
      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 123);

      expect(mockShell.openExternal).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'Invalid URL type' });
    });

    it('should reject file:// protocol', async () => {
      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 'file:///etc/passwd');

      expect(mockShell.openExternal).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'Protocol file: not allowed' });
    });

    it('should reject javascript: protocol', async () => {
      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 'javascript:alert(1)');

      expect(mockShell.openExternal).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'Protocol javascript: not allowed' });
    });

    it('should reject invalid URL format', async () => {
      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 'not a url');

      expect(mockShell.openExternal).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'Invalid URL format' });
    });

    it('should handle shell.openExternal failure', async () => {
      mockShell.openExternal.mockRejectedValue(new Error('Failed'));

      const handler = mockIpcHandlers.get('open-external');
      const result = await handler!(null, 'https://example.com');

      expect(result).toEqual({ success: false, error: 'Invalid URL format' });
    });
  });

  describe('renderer-ready', () => {
    it('should set renderer ready flag', async () => {
      const handler = mockIpcHandlers.get('renderer-ready');
      const result = await handler!();

      expect(deps.setIsRendererReady).toHaveBeenCalledWith(true);
      expect(deps.onRendererReady).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should send pending text when available', async () => {
      const pendingText = {
        text: 'pending prompt',
        capturedContext: { project: 'test' },
        isSourceAppBlocked: false,
      };
      (deps.getPendingText as Mock).mockReturnValue(pendingText);

      const handler = mockIpcHandlers.get('renderer-ready');
      await handler!();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('clipboard-text', pendingText);
      expect(deps.clearPendingText).toHaveBeenCalled();
    });

    it('should not send when no pending text', async () => {
      (deps.getPendingText as Mock).mockReturnValue(null);

      const handler = mockIpcHandlers.get('renderer-ready');
      await handler!();

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
      expect(deps.clearPendingText).not.toHaveBeenCalled();
    });

    it('should not crash when window is null', async () => {
      (deps.mainWindow as Mock).mockReturnValue(null);
      (deps.getPendingText as Mock).mockReturnValue({ text: 'test' });

      const handler = mockIpcHandlers.get('renderer-ready');
      const result = await handler!();

      expect(result).toBe(true);
      expect(deps.setIsRendererReady).toHaveBeenCalledWith(true);
    });

    it('should handle complex pending context', async () => {
      const complexPending = {
        text: 'Fix authentication bug',
        capturedContext: {
          project: 'my-app',
          techStack: ['React', 'TypeScript'],
          currentTask: 'Implementing login',
        },
        isSourceAppBlocked: true,
      };
      (deps.getPendingText as Mock).mockReturnValue(complexPending);

      const handler = mockIpcHandlers.get('renderer-ready');
      await handler!();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('clipboard-text', complexPending);
    });
  });

  describe('IPC registration', () => {
    it('should register all window handlers', () => {
      expect(mockIpcHandlers.has('get-app-version')).toBe(true);
      expect(mockIpcHandlers.has('hide-window')).toBe(true);
      expect(mockIpcHandlers.has('minimize-window')).toBe(true);
      expect(mockIpcHandlers.has('open-external')).toBe(true);
      expect(mockIpcHandlers.has('renderer-ready')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(5);
    });
  });
});
