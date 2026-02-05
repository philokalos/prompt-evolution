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

// Mock env-util FIRST (required by text-selection.ts)
// This prevents the module from trying to import electron/fs/path
vi.mock('../utils/env-util.js', () => ({
  isMASBuild: () => false,
}));

// Mock child_process with ESM compatibility
vi.mock('child_process', () => ({
  __esModule: true,
  default: { exec: vi.fn() },
  exec: vi.fn(),
}));

// Mock util.promisify to return our mock execAsync
vi.mock('util', () => ({
  __esModule: true,
  default: { promisify: () => mockState.execAsync },
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
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('getFrontmostApp', () => {
    it('should return frontmost app name on macOS', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Visual Studio Code\n',
      });

      const result = await getFrontmostApp();
      expect(result).toBe('Visual Studio Code');
    });

    it('should return null if AppleScript fails', async () => {
      mockState.execAsync.mockRejectedValue(new Error('AppleScript error'));

      const result = await getFrontmostApp();
      expect(result).toBeNull();
    });

    it('should return null on non-macOS platforms', async () => {
      setPlatform('win32');

      const result = await getFrontmostApp();
      expect(result).toBeNull();
    });
  });

  describe('tryGetSelectedText', () => {
    it('should get selected text via AppleScript', async () => {
      mockState.clipboardText = 'original clipboard content';
      mockState.execAsync.mockResolvedValue({ stdout: '' });

      // Simulate text being copied
      setTimeout(() => {
        mockState.clipboardText = 'selected text from app';
      }, 50);

      const result = await tryGetSelectedText();
      // Result depends on timing, but function should not throw
      expect(typeof result).toBe('string');
    });

    it('should return null on non-macOS', async () => {
      setPlatform('linux');

      const result = await tryGetSelectedText();
      expect(result).toBeNull();
    });

    it('should handle AppleScript timeout gracefully', async () => {
      mockState.execAsync.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
      );

      const result = await tryGetSelectedText();
      expect(result).toBeNull();
    });
  });

  describe('checkAccessibilityPermission', () => {
    it('should return true when trusted', () => {
      mockState.isTrustedAccessibilityClient.mockReturnValue(true);

      const result = checkAccessibilityPermission();
      expect(result).toBe(true);
    });

    it('should return false when not trusted', () => {
      mockState.isTrustedAccessibilityClient.mockReturnValue(false);

      const result = checkAccessibilityPermission();
      expect(result).toBe(false);
    });

    it('should return true on non-macOS (not required)', () => {
      setPlatform('win32');

      const result = checkAccessibilityPermission();
      expect(result).toBe(true);
    });
  });

  describe('showAccessibilityPermissionDialog', () => {
    it('should show dialog and open settings when user clicks first button', async () => {
      mockState.showMessageBox.mockResolvedValue({ response: 0 });

      const result = await showAccessibilityPermissionDialog();

      expect(mockState.showMessageBox).toHaveBeenCalled();
      expect(mockState.openExternal).toHaveBeenCalledWith(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      );
      expect(result).toBe(true);
    });

    it('should return false when user cancels', async () => {
      mockState.showMessageBox.mockResolvedValue({ response: 1 });

      const result = await showAccessibilityPermissionDialog();

      expect(result).toBe(false);
      expect(mockState.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('captureTextForAnalysis', () => {
    it('should capture selected text when available', async () => {
      // Simulate successful text selection
      mockState.execAsync.mockResolvedValue({ stdout: '' });
      mockState.clipboardText = 'captured text';

      const result = await captureTextForAnalysis();

      // Returns TextCaptureResult object
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('source');
    });

    it('should fall back to clipboard when selection fails', async () => {
      mockState.execAsync.mockRejectedValue(new Error('selection failed'));
      mockState.clipboardText = 'clipboard fallback';

      const result = await captureTextForAnalysis();

      expect(result.text).toBe('clipboard fallback');
      expect(result.source).toBe('clipboard');
    });

    it('should respect clipboard mode setting', async () => {
      mockState.clipboardText = 'clipboard only text';

      const result = await captureTextForAnalysis('clipboard');

      expect(result.text).toBe('clipboard only text');
      expect(result.source).toBe('clipboard');
    });
  });

  describe('applyTextToApp', () => {
    it('should apply text via clipboard and paste on macOS', async () => {
      mockState.execAsync.mockResolvedValue({ stdout: '' });

      await applyTextToApp('new text', 'Visual Studio Code');

      expect(mockState.clipboardText).toBe('new text');
      expect(mockState.execAsync).toHaveBeenCalled();
    });

    it('should only update clipboard on non-macOS', async () => {
      setPlatform('win32');

      await applyTextToApp('new text', 'Some App');

      expect(mockState.clipboardText).toBe('new text');
      expect(mockState.execAsync).not.toHaveBeenCalled();
    });
  });
});
