/**
 * Clipboard Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { ClipboardHandlerDeps } from '../clipboard-handlers.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockClipboard = {
  readText: vi.fn(),
  writeText: vi.fn(),
};

vi.mock('electron', () => ({
  clipboard: mockClipboard,
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
  Notification: vi.fn(),
}));

describe('Clipboard Handlers', () => {
  let deps: ClipboardHandlerDeps;
  let mockMainWindow: ReturnType<typeof vi.fn>;
  let mockApplyTextToApp: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    mockMainWindow = vi.fn();
    mockApplyTextToApp = vi.fn();

    deps = {
      mainWindow: mockMainWindow,
      lastFrontmostApp: vi.fn(),
      showNotification: vi.fn(),
      applyTextToApp: mockApplyTextToApp,
      isBlockedApp: vi.fn(),
      t: (key: string) => key,
    };

    // Dynamically import to ensure mocks are applied
    const { registerClipboardHandlers } = await import('../clipboard-handlers.js');
    registerClipboardHandlers(deps);
  });

  describe('get-clipboard', () => {
    it('should read text from clipboard', async () => {
      mockClipboard.readText.mockReturnValue('test content');

      const handler = mockIpcHandlers.get('get-clipboard');
      const result = await handler!();

      expect(result).toBe('test content');
      expect(mockClipboard.readText).toHaveBeenCalledOnce();
    });

    it('should handle empty clipboard', async () => {
      mockClipboard.readText.mockReturnValue('');

      const handler = mockIpcHandlers.get('get-clipboard');
      const result = await handler!();

      expect(result).toBe('');
    });
  });

  describe('set-clipboard', () => {
    it('should write text to clipboard', async () => {
      const handler = mockIpcHandlers.get('set-clipboard');
      const result = await handler!(null, 'new text');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('new text');
    });

    it('should handle empty text', async () => {
      const handler = mockIpcHandlers.get('set-clipboard');
      await handler!(null, '');

      expect(mockClipboard.writeText).toHaveBeenCalledWith('');
    });
  });

  describe('apply-improved-prompt', () => {
    it('should apply text to app when source app is known', async () => {
      const mockWin = { hide: vi.fn(), isDestroyed: vi.fn().mockReturnValue(false) };
      mockMainWindow.mockReturnValue(mockWin);
      (deps.lastFrontmostApp as Mock).mockReturnValue('VSCode');
      mockApplyTextToApp.mockResolvedValue({ success: true });

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      const result = await handler!(null, 'improved text');

      expect(mockApplyTextToApp).toHaveBeenCalledWith('improved text', 'VSCode');
      expect(deps.showNotification).toHaveBeenCalledWith('PromptLint', 'common:notifications.promptApplied');
      expect(mockWin.hide).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should fallback to clipboard when source app is null', async () => {
      (deps.lastFrontmostApp as Mock).mockReturnValue(null);

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      const result = await handler!(null, 'improved text');

      expect(mockClipboard.writeText).toHaveBeenCalledWith('improved text');
      expect(deps.showNotification).toHaveBeenCalledWith('PromptLint', 'common:notifications.copiedToClipboard');
      expect(mockApplyTextToApp).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        fallback: 'clipboard',
        message: 'common:notifications.copiedToClipboard',
      });
    });

    it('should handle apply failure with clipboard fallback', async () => {
      const mockWin = { hide: vi.fn(), isDestroyed: vi.fn().mockReturnValue(false) };
      mockMainWindow.mockReturnValue(mockWin);
      (deps.lastFrontmostApp as Mock).mockReturnValue('Safari');
      mockApplyTextToApp.mockResolvedValue({
        success: false,
        fallback: 'clipboard',
        message: 'Application not responding',
      });

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      const result = await handler!(null, 'improved text');

      expect(mockApplyTextToApp).toHaveBeenCalledWith('improved text', 'Safari');
      expect(deps.showNotification).toHaveBeenCalledWith('PromptLint', 'Application not responding');
      expect(mockWin.hide).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        fallback: 'clipboard',
        message: 'Application not responding',
      });
    });

    it('should not hide window when window is destroyed', async () => {
      const mockWin = { hide: vi.fn(), isDestroyed: vi.fn().mockReturnValue(true) };
      mockMainWindow.mockReturnValue(mockWin);
      (deps.lastFrontmostApp as Mock).mockReturnValue('VSCode');
      mockApplyTextToApp.mockResolvedValue({ success: true });

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      await handler!(null, 'improved text');

      expect(mockWin.hide).not.toHaveBeenCalled();
    });

    it('should not crash when mainWindow returns null', async () => {
      mockMainWindow.mockReturnValue(null);
      (deps.lastFrontmostApp as Mock).mockReturnValue('VSCode');
      mockApplyTextToApp.mockResolvedValue({ success: true });

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      const result = await handler!(null, 'improved text');

      expect(result).toEqual({ success: true });
    });

    it('should use custom fallback message when provided', async () => {
      (deps.lastFrontmostApp as Mock).mockReturnValue('Chrome');
      mockApplyTextToApp.mockResolvedValue({
        success: false,
        fallback: 'clipboard',
        message: 'Custom error message',
      });

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      await handler!(null, 'improved text');

      expect(deps.showNotification).toHaveBeenCalledWith('PromptLint', 'Custom error message');
    });

    it('should use default message when no custom message provided', async () => {
      (deps.lastFrontmostApp as Mock).mockReturnValue('Terminal');
      mockApplyTextToApp.mockResolvedValue({
        success: false,
        fallback: 'clipboard',
      });

      const handler = mockIpcHandlers.get('apply-improved-prompt');
      await handler!(null, 'improved text');

      expect(deps.showNotification).toHaveBeenCalledWith('PromptLint', 'common:notifications.copiedToClipboard');
    });
  });

  describe('IPC registration', () => {
    it('should register all clipboard handlers', () => {
      expect(mockIpcHandlers.has('get-clipboard')).toBe(true);
      expect(mockIpcHandlers.has('set-clipboard')).toBe(true);
      expect(mockIpcHandlers.has('apply-improved-prompt')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(3);
    });
  });
});
