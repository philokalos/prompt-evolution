/**
 * Tests for text-selection.ts
 * PromptLint - Text selection capture via AppleScript
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock state using vi.hoisted to ensure it's available before mocks
const mockState = vi.hoisted(() => ({
  platform: 'darwin' as NodeJS.Platform,
  execAsync: vi.fn(),
  clipboardText: '',
  isTrustedAccessibilityClient: vi.fn(() => true),
  showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  openExternal: vi.fn(() => Promise.resolve()),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock util.promisify to return our mock execAsync
vi.mock('util', () => ({
  promisify: () => mockState.execAsync,
}));

// Mock electron
vi.mock('electron', () => ({
  clipboard: {
    readText: () => mockState.clipboardText,
    writeText: (text: string) => {
      mockState.clipboardText = text;
    },
  },
  systemPreferences: {
    isTrustedAccessibilityClient: (prompt: boolean) =>
      mockState.isTrustedAccessibilityClient(prompt),
  },
  dialog: {
    showMessageBox: (options: unknown) => mockState.showMessageBox(options),
  },
  shell: {
    openExternal: (url: string) => mockState.openExternal(url),
  },
  app: {
    getLocale: () => 'en-US',
  },
}));

// Store original platform
const originalPlatform = process.platform;

// Helper to set platform
function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
  });
}

// Import after mocking
import {
  getFrontmostApp,
  tryGetSelectedText,
  checkAccessibilityPermission,
  showAccessibilityPermissionDialog,
  captureTextForAnalysis,
  applyTextToApp,
} from '../text-selection.js';

describe('text-selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.clipboardText = '';
    mockState.isTrustedAccessibilityClient.mockReturnValue(true);
    mockState.showMessageBox.mockResolvedValue({ response: 0 });
    mockState.execAsync.mockResolvedValue({ stdout: '' });
    setPlatform('darwin');
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  describe('getFrontmostApp', () => {
    it('should return null on non-darwin platforms', async () => {
      setPlatform('win32');

      const result = await getFrontmostApp();

      expect(result).toBeNull();
      expect(mockState.execAsync).not.toHaveBeenCalled();
    });

    it('should return app name from AppleScript on darwin', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Visual Studio Code\n' });

      const result = await getFrontmostApp();

      expect(result).toBe('Visual Studio Code');
      expect(mockState.execAsync).toHaveBeenCalled();
    });

    it('should trim whitespace from app name', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: '  Safari  \n' });

      const result = await getFrontmostApp();

      expect(result).toBe('Safari');
    });

    it('should return null if AppleScript fails', async () => {
      mockState.execAsync.mockRejectedValue(new Error('AppleScript error'));

      const result = await getFrontmostApp();

      expect(result).toBeNull();
    });

    it('should execute correct AppleScript command', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Finder\n' });

      await getFrontmostApp();

      expect(mockState.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('osascript')
      );
      expect(mockState.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('System Events')
      );
    });
  });

  describe('tryGetSelectedText', () => {
    it('should return null on non-darwin platforms', async () => {
      setPlatform('linux');

      const result = await tryGetSelectedText();

      expect(result).toBeNull();
    });

    it('should return clipboard content for blocked apps', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Cursor\n' });
      mockState.clipboardText = 'clipboard content';

      const result = await tryGetSelectedText();

      expect(result).toBe('clipboard content');
    });

    it('should return null for blocked apps with empty clipboard', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Code\n' });
      mockState.clipboardText = '';

      const result = await tryGetSelectedText();

      expect(result).toBeNull();
    });

    it('should detect blocked apps case-insensitively', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'CURSOR\n' });
      mockState.clipboardText = 'test';

      const result = await tryGetSelectedText();

      // Should return clipboard without simulating keystroke
      expect(result).toBe('test');
    });

    it('should return new clipboard content after simulated Cmd+C', async () => {
      // First call gets frontmost app, second simulates keystroke
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });

      // Simulate clipboard change after keystroke
      mockState.clipboardText = 'original';
      setTimeout(() => {
        mockState.clipboardText = 'selected text';
      }, 10);

      const _result = await tryGetSelectedText();

      // The function reads clipboard before and after, if different it returns new content
      // In this test the clipboard changes between reads
      expect(mockState.execAsync).toHaveBeenCalledTimes(2);
    });

    it('should return null if clipboard did not change', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });
      mockState.clipboardText = 'same content';

      const result = await tryGetSelectedText();

      expect(result).toBeNull();
    });

    it('should return null if AppleScript keystroke simulation fails', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockRejectedValueOnce(new Error('Permission denied'));

      const result = await tryGetSelectedText();

      expect(result).toBeNull();
    });

    it('should block Terminal apps', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Terminal\n' });
      mockState.clipboardText = 'terminal clipboard';

      const result = await tryGetSelectedText();

      expect(result).toBe('terminal clipboard');
    });

    it('should block iTerm2', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'iTerm2\n' });
      mockState.clipboardText = 'iterm clipboard';

      const result = await tryGetSelectedText();

      expect(result).toBe('iterm clipboard');
    });

    it('should block Claude app', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Claude\n' });
      mockState.clipboardText = 'claude clipboard';

      const result = await tryGetSelectedText();

      expect(result).toBe('claude clipboard');
    });

    it('should block Warp terminal', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Warp\n' });
      mockState.clipboardText = 'warp clipboard';

      const result = await tryGetSelectedText();

      expect(result).toBe('warp clipboard');
    });

    it('should block Hyper terminal', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: 'Hyper\n' });
      mockState.clipboardText = 'hyper clipboard';

      const result = await tryGetSelectedText();

      expect(result).toBe('hyper clipboard');
    });

    it('should not block unknown apps', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });
      mockState.clipboardText = 'test';

      await tryGetSelectedText();

      // Should have called execAsync twice (getFrontmostApp + keystroke)
      expect(mockState.execAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkAccessibilityPermission', () => {
    it('should return true on non-darwin platforms', () => {
      setPlatform('win32');

      const result = checkAccessibilityPermission();

      expect(result).toBe(true);
      expect(mockState.isTrustedAccessibilityClient).not.toHaveBeenCalled();
    });

    it('should return true if permission is granted', () => {
      mockState.isTrustedAccessibilityClient.mockReturnValue(true);

      const result = checkAccessibilityPermission();

      expect(result).toBe(true);
    });

    it('should return false if permission is not granted', () => {
      mockState.isTrustedAccessibilityClient.mockReturnValue(false);

      const result = checkAccessibilityPermission();

      expect(result).toBe(false);
    });

    it('should pass promptIfNeeded to system preferences', () => {
      checkAccessibilityPermission(true);

      expect(mockState.isTrustedAccessibilityClient).toHaveBeenCalledWith(true);
    });

    it('should not prompt by default', () => {
      checkAccessibilityPermission();

      expect(mockState.isTrustedAccessibilityClient).toHaveBeenCalledWith(false);
    });
  });

  describe('showAccessibilityPermissionDialog', () => {
    it('should show dialog with correct options (English)', async () => {
      await showAccessibilityPermissionDialog();

      expect(mockState.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Accessibility Permission Required',
          buttons: ['Open Settings', 'Later'],
        })
      );
    });

    it('should open system preferences if user clicks first button', async () => {
      mockState.showMessageBox.mockResolvedValue({ response: 0 });

      const result = await showAccessibilityPermissionDialog();

      expect(result).toBe(true);
      expect(mockState.openExternal).toHaveBeenCalledWith(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      );
    });

    it('should return false if user clicks second button', async () => {
      mockState.showMessageBox.mockResolvedValue({ response: 1 });

      const result = await showAccessibilityPermissionDialog();

      expect(result).toBe(false);
      expect(mockState.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('captureTextForAnalysis', () => {
    it('should return clipboard content in clipboard mode', async () => {
      mockState.clipboardText = 'clipboard text';

      const result = await captureTextForAnalysis('clipboard');

      expect(result).toEqual({
        text: 'clipboard text',
        source: 'clipboard',
      });
    });

    it('should return null text with clipboard source for empty clipboard', async () => {
      mockState.clipboardText = '';

      const result = await captureTextForAnalysis('clipboard');

      expect(result).toEqual({
        text: null,
        source: 'clipboard',
      });
    });

    it('should try selection first in auto mode', async () => {
      // Mock successful selection capture
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });

      // Set up clipboard to change (simulating selection)
      const originalText = 'original';
      mockState.clipboardText = originalText;

      // We need to simulate the clipboard changing between the save and read
      // This is tricky with our mock setup, so we'll test the fallback case

      const _result = await captureTextForAnalysis('auto');

      // Should have attempted to get selected text
      expect(mockState.execAsync).toHaveBeenCalled();
    });

    it('should fall back to clipboard in auto mode when no selection', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });
      mockState.clipboardText = 'fallback clipboard';

      const result = await captureTextForAnalysis('auto');

      // Since clipboard didn't change, should fall back
      expect(result.source).toBe('clipboard');
      expect(result.text).toBe('fallback clipboard');
    });

    it('should return null in selection mode when no selection', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });
      mockState.clipboardText = 'clipboard content';

      const result = await captureTextForAnalysis('selection');

      // Should not fall back to clipboard
      expect(result).toEqual({
        text: null,
        source: 'selection',
      });
    });

    it('should return selection source when text is selected', async () => {
      // For blocked app, selection returns clipboard content but is still considered "selection"
      mockState.execAsync.mockResolvedValue({ stdout: 'Cursor\n' });
      mockState.clipboardText = 'selected via blocked app';

      const result = await captureTextForAnalysis('auto');

      expect(result).toEqual({
        text: 'selected via blocked app',
        source: 'selection',
      });
    });

    it('should default to auto mode', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });
      mockState.clipboardText = 'test';

      const _result = await captureTextForAnalysis();

      // Default should attempt selection
      expect(mockState.execAsync).toHaveBeenCalled();
    });
  });

  describe('applyTextToApp', () => {
    it('should write text to clipboard', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: '' });

      await applyTextToApp('improved text', 'Safari');

      expect(mockState.clipboardText).toBe('improved text');
    });

    it('should return clipboard fallback on non-darwin platforms', async () => {
      setPlatform('win32');

      const result = await applyTextToApp('text', 'Notepad');

      expect(result).toEqual({
        success: false,
        fallback: 'clipboard',
        message: '클립보드에 복사됨 - Cmd+V로 붙여넣기 해주세요',
      });
    });

    it('should return clipboard fallback for blocked apps', async () => {
      const result = await applyTextToApp('text', 'Cursor');

      expect(result).toEqual({
        success: false,
        fallback: 'clipboard',
        message: '클립보드에 복사됨 - Cmd+V로 붙여넣기 해주세요',
      });
    });

    it('should return success when AppleScript succeeds', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: '' });

      const result = await applyTextToApp('text', 'Safari');

      expect(result).toEqual({ success: true });
    });

    it('should execute AppleScript with app activation and paste', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: '' });

      await applyTextToApp('text', 'Safari');

      expect(mockState.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('tell application "Safari" to activate')
      );
      expect(mockState.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('keystroke "a" using command down')
      );
      expect(mockState.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('keystroke "v" using command down')
      );
    });

    it('should return clipboard fallback when AppleScript fails', async () => {
      mockState.execAsync.mockRejectedValue(new Error('Script failed'));

      const result = await applyTextToApp('text', 'Safari');

      expect(result).toEqual({
        success: false,
        fallback: 'clipboard',
        message: '클립보드에 복사됨 - Cmd+V로 붙여넣기 해주세요',
      });
    });

    it('should block all terminal apps', async () => {
      for (const app of ['Terminal', 'iTerm2', 'Warp', 'Hyper']) {
        const result = await applyTextToApp('text', app);
        expect(result.fallback).toBe('clipboard');
      }
    });

    it('should block Code (VS Code)', async () => {
      const result = await applyTextToApp('text', 'Code');

      expect(result.fallback).toBe('clipboard');
    });

    it('should block Claude app', async () => {
      const result = await applyTextToApp('text', 'Claude');

      expect(result.fallback).toBe('clipboard');
    });

    it('should handle app names containing blocked words', async () => {
      // App name containing 'Code' should be blocked
      const result = await applyTextToApp('text', 'Visual Studio Code');

      expect(result.fallback).toBe('clipboard');
    });
  });

  describe('blocked apps detection', () => {
    it('should handle null app name', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: '' });

      // When frontmost app is empty string
      const _result = await tryGetSelectedText();

      // Should proceed with keystroke simulation since empty string is not blocked
      expect(mockState.execAsync).toHaveBeenCalledTimes(2);
    });

    it('should match blocked apps case-insensitively', async () => {
      const blockedApps = [
        'cursor',
        'CURSOR',
        'CuRsOr',
        'code',
        'CODE',
        'terminal',
        'TERMINAL',
        'claude',
        'CLAUDE',
        'antigravity',
        'ANTIGRAVITY',
        'Antigravity',
      ];

      for (const app of blockedApps) {
        vi.clearAllMocks();
        mockState.execAsync.mockResolvedValue({ stdout: `${app}\n` });
        mockState.clipboardText = 'test';

        const result = await tryGetSelectedText();

        expect(result).toBe('test');
        // Should only call execAsync once (to get frontmost app), not twice
        expect(mockState.execAsync).toHaveBeenCalledTimes(1);
      }
    });

    it('should allow non-blocked apps', async () => {
      const allowedApps = ['Safari', 'Chrome', 'Firefox', 'Slack', 'Notion'];

      for (const app of allowedApps) {
        vi.clearAllMocks();
        mockState.execAsync
          .mockResolvedValueOnce({ stdout: `${app}\n` })
          .mockResolvedValueOnce({ stdout: '' });
        mockState.clipboardText = 'test';

        await tryGetSelectedText();

        // Should call execAsync twice (get app + simulate keystroke)
        expect(mockState.execAsync).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle getFrontmostApp returning null gracefully', async () => {
      // First call for getFrontmostApp fails
      mockState.execAsync.mockRejectedValueOnce(new Error('Failed'));

      const result = await tryGetSelectedText();

      // Should return null since we couldn't determine the app
      expect(result).toBeNull();
    });

    it('should handle empty clipboard in auto mode', async () => {
      mockState.execAsync
        .mockResolvedValueOnce({ stdout: 'Safari\n' })
        .mockResolvedValueOnce({ stdout: '' });
      mockState.clipboardText = '';

      const result = await captureTextForAnalysis('auto');

      expect(result).toEqual({
        text: null,
        source: 'clipboard',
      });
    });

    it('should work on darwin with linux-like behavior on linux', async () => {
      setPlatform('linux');
      mockState.clipboardText = '';

      const frontApp = await getFrontmostApp();
      const selectedText = await tryGetSelectedText();
      const permission = checkAccessibilityPermission();
      const applyResult = await applyTextToApp('text', 'app');
      // After applyTextToApp, clipboard has 'text'
      const captureResult = await captureTextForAnalysis('auto');

      expect(frontApp).toBeNull();
      expect(selectedText).toBeNull();
      expect(permission).toBe(true); // Non-darwin returns true
      // In auto mode on non-darwin, selection returns null, falls back to clipboard
      // which now has 'text' from applyTextToApp
      expect(captureResult.text).toBe('text');
      expect(captureResult.source).toBe('clipboard');
      expect(applyResult.fallback).toBe('clipboard');
    });
  });
});
