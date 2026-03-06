/**
 * Tests for copyAndSwitch() function (TDD)
 *
 * copyAndSwitch is designed for blocked apps (VS Code, Cursor, etc.)
 * that crash with keystroke simulation. It copies to clipboard and
 * switches focus via AppleScript `activate` (no keystrokes).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => ({
  platform: 'darwin' as NodeJS.Platform,
  execAsync: vi.fn(),
  clipboardText: '',
  isMASBuild: false,
}));

vi.mock('../utils/env-util.js', () => ({
  isMASBuild: () => mockState.isMASBuild,
}));

vi.mock('child_process', () => ({
  __esModule: true,
  default: { exec: vi.fn() },
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  __esModule: true,
  default: { promisify: () => mockState.execAsync },
  promisify: () => mockState.execAsync,
}));

vi.mock('electron', () => ({
  clipboard: {
    readText: () => mockState.clipboardText,
    writeText: (text: string) => {
      mockState.clipboardText = text;
    },
  },
  systemPreferences: {
    isTrustedAccessibilityClient: () => true,
  },
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
  },
  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
  },
  app: {
    getLocale: () => 'en-US',
  },
}));

// Patch process.platform
const _originalPlatform = process.platform;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: mockState.platform });
  mockState.clipboardText = '';
  mockState.execAsync.mockReset();
  mockState.isMASBuild = false;
  mockState.platform = 'darwin';
});

import { copyAndSwitch } from '../text-selection.js';

describe('copyAndSwitch', () => {
  it('should copy text to clipboard', async () => {
    mockState.execAsync.mockResolvedValue({ stdout: '' });

    const result = await copyAndSwitch('improved prompt', 'Cursor');

    expect(result.copiedToClipboard).toBe(true);
    expect(mockState.clipboardText).toBe('improved prompt');
  });

  it('should activate the source app via AppleScript', async () => {
    mockState.execAsync.mockResolvedValue({ stdout: '' });

    await copyAndSwitch('improved prompt', 'Cursor');

    // Should call execAsync with AppleScript that activates the app
    expect(mockState.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('activate')
    );
    // Should NOT use keystroke (blocked apps crash with keystrokes)
    const callArg = mockState.execAsync.mock.calls[0][0] as string;
    expect(callArg).not.toContain('keystroke');
  });

  it('should return success when app switch works', async () => {
    mockState.execAsync.mockResolvedValue({ stdout: '' });

    const result = await copyAndSwitch('text', 'Cursor');

    expect(result.success).toBe(true);
    expect(result.appSwitched).toBe(true);
    expect(result.copiedToClipboard).toBe(true);
  });

  it('should sanitize app name to prevent AppleScript injection', async () => {
    mockState.execAsync.mockResolvedValue({ stdout: '' });

    const result = await copyAndSwitch('text', 'Evil"; do shell script "rm -rf /"');

    // Should still copy to clipboard but reject the invalid app name
    expect(result.copiedToClipboard).toBe(true);
    expect(result.appSwitched).toBe(false);
  });

  it('should fallback to clipboard-only when AppleScript fails', async () => {
    mockState.execAsync.mockRejectedValue(new Error('AppleScript error'));

    const result = await copyAndSwitch('text', 'Cursor');

    expect(result.copiedToClipboard).toBe(true);
    expect(result.appSwitched).toBe(false);
    expect(result.success).toBe(true); // Still success because clipboard worked
  });

  it('should handle non-darwin platform gracefully', async () => {
    mockState.platform = 'win32';
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const result = await copyAndSwitch('text', 'Code');

    expect(result.copiedToClipboard).toBe(true);
    expect(result.appSwitched).toBe(false);
  });

  it('should handle MAS build (no AppleScript)', async () => {
    mockState.isMASBuild = true;

    const result = await copyAndSwitch('text', 'Cursor');

    expect(result.copiedToClipboard).toBe(true);
    expect(result.appSwitched).toBe(false);
    expect(mockState.execAsync).not.toHaveBeenCalled();
  });

  it('should handle empty app name', async () => {
    const result = await copyAndSwitch('text', '');

    expect(result.copiedToClipboard).toBe(true);
    expect(result.appSwitched).toBe(false);
  });
});
