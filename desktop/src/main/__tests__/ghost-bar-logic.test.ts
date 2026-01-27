/**
 * Ghost Bar Logic Unit Tests
 *
 * Tests for the Ghost Bar floating mini-bar functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GhostBarState, GhostBarSettings } from '../ghost-bar-types.js';

// Mock Electron modules
const mockBrowserWindow = {
  loadURL: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  destroy: vi.fn(),
  setPosition: vi.fn(),
  setVisibleOnAllWorkspaces: vi.fn(),
  isDestroyed: vi.fn().mockReturnValue(false),
  isVisible: vi.fn().mockReturnValue(true),
  webContents: {
    send: vi.fn(),
  },
  on: vi.fn(),
};

const mockScreen = {
  getCursorScreenPoint: vi.fn().mockReturnValue({ x: 500, y: 500 }),
  getDisplayNearestPoint: vi.fn().mockReturnValue({
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  }),
};

const mockGlobalShortcut = {
  register: vi.fn().mockReturnValue(true),
  unregister: vi.fn(),
};

const mockClipboard = {
  writeText: vi.fn(),
  readText: vi.fn(),
};

const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

// Create BrowserWindow mock constructor
function MockBrowserWindow(this: typeof mockBrowserWindow) {
  Object.assign(this, mockBrowserWindow);
  return this;
}

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(MockBrowserWindow),
  screen: mockScreen,
  globalShortcut: mockGlobalShortcut,
  clipboard: mockClipboard,
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

// Mock text-selection module
const mockApplyTextToApp = vi.fn();
vi.mock('../text-selection.js', () => ({
  applyTextToApp: mockApplyTextToApp,
}));

describe('Ghost Bar Logic', () => {
  let ghostBarModule: typeof import('../ghost-bar.js');

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();
    vi.useFakeTimers();

    // Reset mock implementations
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
    mockBrowserWindow.isVisible.mockReturnValue(true);
    mockGlobalShortcut.register.mockReturnValue(true);
    mockApplyTextToApp.mockResolvedValue({ success: true });

    // Reset screen mocks
    mockScreen.getCursorScreenPoint.mockReturnValue({ x: 500, y: 500 });
    mockScreen.getDisplayNearestPoint.mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    });

    // Dynamically import to ensure mocks are applied
    ghostBarModule = await import('../ghost-bar.js');
    ghostBarModule.registerGhostBarHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up Ghost Bar state after each test
    try {
      ghostBarModule.destroyGhostBar();
    } catch {
      // Ignore if already destroyed
    }
  });

  const mockState: GhostBarState = {
    id: 'test-id',
    originalText: 'Fix this bug',
    improvedText: 'Please analyze and fix the bug in the authentication flow.',
    originalGrade: 'D',
    improvedGrade: 'A',
    originalScore: 25,
    improvedScore: 90,
    variantType: 'balanced',
    isBlockedApp: false,
    sourceApp: 'VSCode',
  };

  const mockSettings: GhostBarSettings = {
    enabled: true,
    autoPaste: true,
    dismissTimeout: 5000,
    showOnlyOnImprovement: true,
    minimumConfidence: 0.3,
  };

  describe('createGhostBar', () => {
    it('should create window (verified by visibility)', () => {
      expect(ghostBarModule.isGhostBarVisible()).toBe(false);
      ghostBarModule.createGhostBar();
      // Window is created but not shown yet
      expect(mockBrowserWindow.loadURL).toHaveBeenCalled();
      expect(mockBrowserWindow.setVisibleOnAllWorkspaces).toHaveBeenCalled();
    });

    it('should calculate position near cursor', () => {
      mockScreen.getCursorScreenPoint.mockReturnValue({ x: 100, y: 100 });
      ghostBarModule.createGhostBar();

      // Verify screen methods were called
      expect(mockScreen.getCursorScreenPoint).toHaveBeenCalled();
      expect(mockScreen.getDisplayNearestPoint).toHaveBeenCalled();
    });

    it('should handle right screen boundary', () => {
      mockScreen.getCursorScreenPoint.mockReturnValue({ x: 1900, y: 100 });
      ghostBarModule.createGhostBar();

      // Position calculation happens, window is created
      expect(mockBrowserWindow.loadURL).toHaveBeenCalled();
    });

    it('should handle left screen boundary', () => {
      mockScreen.getCursorScreenPoint.mockReturnValue({ x: -10, y: 100 });
      ghostBarModule.createGhostBar();

      expect(mockBrowserWindow.loadURL).toHaveBeenCalled();
    });

    it('should handle bottom screen boundary', () => {
      mockScreen.getCursorScreenPoint.mockReturnValue({ x: 500, y: 1070 });
      ghostBarModule.createGhostBar();

      expect(mockBrowserWindow.loadURL).toHaveBeenCalled();
    });

    it('should not create duplicate window', () => {
      ghostBarModule.createGhostBar();
      const firstCallCount = mockBrowserWindow.loadURL.mock.calls.length;

      ghostBarModule.createGhostBar();
      const secondCallCount = mockBrowserWindow.loadURL.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount); // No additional call
    });
  });

  describe('showGhostBar', () => {
    it('should show window and send state', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      expect(mockBrowserWindow.show).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:show', {
        originalGrade: 'D',
        improvedGrade: 'A',
        originalScore: 25,
        improvedScore: 90,
        isBlockedApp: false,
        sourceApp: 'VSCode',
      });
    });

    it('should register shortcuts', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      expect(mockGlobalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+Return',
        expect.any(Function)
      );
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('Escape', expect.any(Function));
    });

    it('should start dismiss timeout', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      vi.advanceTimersByTime(5000);
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
    });

    it('should clamp timeout to minimum 5 seconds', () => {
      const shortSettings = { ...mockSettings, dismissTimeout: 1000 };
      ghostBarModule.showGhostBar(mockState, shortSettings);

      vi.advanceTimersByTime(1000);
      expect(mockBrowserWindow.webContents.send).not.toHaveBeenCalledWith('ghost-bar:hide');

      vi.advanceTimersByTime(4000); // Total 5000ms
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
    });

    it('should clamp timeout to maximum 30 seconds', () => {
      const longSettings = { ...mockSettings, dismissTimeout: 60000 };
      ghostBarModule.showGhostBar(mockState, longSettings);

      vi.advanceTimersByTime(30000);
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
    });

    it('should update position to current cursor location', () => {
      ghostBarModule.createGhostBar();
      mockScreen.getCursorScreenPoint.mockReturnValue({ x: 800, y: 600 });

      ghostBarModule.showGhostBar(mockState, mockSettings);

      expect(mockBrowserWindow.setPosition).toHaveBeenCalledWith(800, 608); // y + 8px
    });
  });

  describe('hideGhostBar', () => {
    it('should send hide signal and hide window after animation', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      ghostBarModule.hideGhostBar();

      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');

      vi.advanceTimersByTime(100);
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });

    it('should unregister shortcuts', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      ghostBarModule.hideGhostBar();

      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+Shift+Return');
      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('Escape');
    });

    it('should clear dismiss timeout', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      ghostBarModule.hideGhostBar();

      vi.advanceTimersByTime(10000);
      // Hide should not be called again by timeout
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledTimes(2); // show + hide, not timeout
    });

    it('should not crash when window is destroyed', () => {
      mockBrowserWindow.isDestroyed.mockReturnValue(true);
      expect(() => ghostBarModule.hideGhostBar()).not.toThrow();
    });
  });

  describe('destroyGhostBar', () => {
    it('should destroy window and clear state', () => {
      ghostBarModule.createGhostBar();
      ghostBarModule.destroyGhostBar();

      expect(mockBrowserWindow.destroy).toHaveBeenCalled();
    });

    it('should unregister shortcuts before destroying', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      ghostBarModule.destroyGhostBar();

      expect(mockGlobalShortcut.unregister).toHaveBeenCalled();
    });

    it('should clear dismiss timeout', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      ghostBarModule.destroyGhostBar();

      vi.advanceTimersByTime(10000);
      expect(mockBrowserWindow.webContents.send).not.toHaveBeenCalledWith('ghost-bar:hide');
    });
  });

  describe('isGhostBarVisible', () => {
    it('should return true when window is visible', () => {
      ghostBarModule.createGhostBar();
      mockBrowserWindow.isVisible.mockReturnValue(true);

      expect(ghostBarModule.isGhostBarVisible()).toBe(true);
    });

    it('should return false when window is hidden', () => {
      ghostBarModule.createGhostBar();
      mockBrowserWindow.isVisible.mockReturnValue(false);

      expect(ghostBarModule.isGhostBarVisible()).toBe(false);
    });

    it('should return false when window is destroyed', () => {
      ghostBarModule.createGhostBar();
      mockBrowserWindow.isDestroyed.mockReturnValue(true);

      expect(ghostBarModule.isGhostBarVisible()).toBe(false);
    });

    it('should return false after destroy', () => {
      ghostBarModule.createGhostBar();

      // Mark window as destroyed
      mockBrowserWindow.isDestroyed.mockReturnValue(true);

      expect(ghostBarModule.isGhostBarVisible()).toBe(false);
    });
  });

  describe('getCurrentGhostBarState', () => {
    it('should return current state after show', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const state = ghostBarModule.getCurrentGhostBarState();
      expect(state).toEqual(mockState);
    });

    it('should return null initially', () => {
      const state = ghostBarModule.getCurrentGhostBarState();
      expect(state).toBeNull();
    });

    it('should return null after destroy', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      ghostBarModule.destroyGhostBar();

      const state = ghostBarModule.getCurrentGhostBarState();
      expect(state).toBeNull();
    });
  });

  describe('ghost-bar:apply IPC handler', () => {
    it('should write improved text to clipboard', async () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      await handler!();

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockState.improvedText);
    });

    it('should apply text to app when not blocked', async () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      mockApplyTextToApp.mockResolvedValue({ success: true });

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      const result = await handler!();

      expect(mockApplyTextToApp).toHaveBeenCalledWith(mockState.improvedText, 'VSCode');
      expect(result).toEqual({ success: true });
    });

    it('should use clipboard fallback when app is blocked', async () => {
      const blockedState = { ...mockState, isBlockedApp: true };
      ghostBarModule.showGhostBar(blockedState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      const result = await handler!();

      expect(mockApplyTextToApp).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        fallback: 'clipboard',
        message: expect.stringContaining('Cmd+V'),
      });
    });

    it('should handle apply failure gracefully', async () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);
      mockApplyTextToApp.mockRejectedValue(new Error('App not responding'));

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      const result = await handler!();

      expect(result).toMatchObject({
        success: false,
        fallback: 'clipboard',
        message: expect.stringContaining('Auto-paste failed'),
      });
    });

    it('should hide ghost bar after apply', async () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      await handler!();

      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
    });

    it('should return error when no improved text', async () => {
      const emptyState = { ...mockState, improvedText: '' };
      ghostBarModule.showGhostBar(emptyState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      const result = await handler!();

      expect(result).toEqual({ success: false, message: 'No improved text available' });
    });

    it('should return error when no state', async () => {
      const handler = mockIpcHandlers.get('ghost-bar:apply');
      const result = await handler!();

      expect(result).toEqual({ success: false, message: 'No active state' });
    });
  });

  describe('ghost-bar:dismiss IPC handler', () => {
    it('should hide ghost bar', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:dismiss');
      handler!();

      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
    });
  });

  describe('ghost-bar:expand IPC handler', () => {
    it('should call expand callback', () => {
      const expandCallback = vi.fn();
      ghostBarModule.setOnExpandCallback(expandCallback);
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:expand');
      handler!();

      expect(expandCallback).toHaveBeenCalledWith(mockState);
    });

    it('should hide ghost bar after expand', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:expand');
      handler!();

      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('ghost-bar:hide');
    });
  });

  describe('callbacks', () => {
    it('should call apply callback after successful apply', async () => {
      const applyCallback = vi.fn();
      ghostBarModule.setOnApplyCallback(applyCallback);
      ghostBarModule.showGhostBar(mockState, mockSettings);

      const handler = mockIpcHandlers.get('ghost-bar:apply');
      await handler!();

      expect(applyCallback).toHaveBeenCalledWith(mockState);
    });
  });

  describe('resetDismissTimeout', () => {
    it('should restart timeout', () => {
      ghostBarModule.showGhostBar(mockState, mockSettings);

      vi.advanceTimersByTime(4000); // Almost timeout
      ghostBarModule.resetDismissTimeout(5000); // Reset

      vi.advanceTimersByTime(4000); // Should not timeout yet
      expect(mockBrowserWindow.hide).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000); // Total 5000ms from reset
      vi.advanceTimersByTime(100); // Animation
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });
  });
});
