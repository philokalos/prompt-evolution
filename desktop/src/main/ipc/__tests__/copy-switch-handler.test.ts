/**
 * Tests for copy-and-switch IPC handler (TDD)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mockHandlers.set(channel, handler);
    },
  },
}));

import { registerCopySwitchHandler, type CopySwitchHandlerDeps } from '../copy-switch-handler.js';

describe('copy-and-switch IPC handler', () => {
  let deps: CopySwitchHandlerDeps;

  beforeEach(() => {
    mockHandlers.clear();
    deps = {
      copyAndSwitch: vi.fn().mockResolvedValue({
        success: true,
        copiedToClipboard: true,
        appSwitched: true,
      }),
      hideWindow: vi.fn(),
    };
    registerCopySwitchHandler(deps);
  });

  it('should register copy-and-switch handler', () => {
    expect(mockHandlers.has('copy-and-switch')).toBe(true);
  });

  it('should call copyAndSwitch with text and sourceApp', async () => {
    const handler = mockHandlers.get('copy-and-switch')!;

    await handler({}, { text: 'improved text', sourceApp: 'Cursor' });

    expect(deps.copyAndSwitch).toHaveBeenCalledWith('improved text', 'Cursor');
  });

  it('should hide window after successful copy & switch', async () => {
    const handler = mockHandlers.get('copy-and-switch')!;

    await handler({}, { text: 'text', sourceApp: 'Code' });

    expect(deps.hideWindow).toHaveBeenCalled();
  });

  it('should return the result from copyAndSwitch', async () => {
    const handler = mockHandlers.get('copy-and-switch')!;

    const result = await handler({}, { text: 'text', sourceApp: 'Cursor' });

    expect(result).toEqual({
      success: true,
      copiedToClipboard: true,
      appSwitched: true,
    });
  });

  it('should handle missing text gracefully', async () => {
    const handler = mockHandlers.get('copy-and-switch')!;

    const result = await handler({}, { text: '', sourceApp: 'Cursor' });

    expect(result).toEqual({
      success: false,
      copiedToClipboard: false,
      appSwitched: false,
      message: 'No text provided',
    });
    expect(deps.copyAndSwitch).not.toHaveBeenCalled();
  });

  it('should handle missing sourceApp', async () => {
    const handler = mockHandlers.get('copy-and-switch')!;

    await handler({}, { text: 'text', sourceApp: '' });

    expect(deps.copyAndSwitch).toHaveBeenCalledWith('text', '');
  });
});
