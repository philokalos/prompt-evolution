/**
 * AI Context Popup Unit Tests
 *
 * Tests for the floating button HTML generation and positioning logic.
 * Note: BrowserWindow creation is mocked at module level to avoid Electron dependency.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted() to ensure mock state is available when vi.mock runs
const mockState = vi.hoisted(() => ({
  constructorCalls: [] as unknown[][],
  webContentsOn: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  destroy: vi.fn(),
  isDestroyed: vi.fn(() => false),
  isVisible: vi.fn(() => false),
  loadURL: vi.fn().mockResolvedValue(undefined),
  setVisibleOnAllWorkspaces: vi.fn(),
  setIgnoreMouseEvents: vi.fn(),  // Fix keyboard focus passthrough
  ipcMainOn: vi.fn(),
}));

// Mock Electron modules before importing the module under test
vi.mock('electron', async () => {
  // Use a class-based mock for BrowserWindow constructor
  const MockBrowserWindow = function(this: Record<string, unknown>, options: unknown) {
    mockState.constructorCalls.push([options]);
    this.show = mockState.show;
    this.hide = mockState.hide;
    this.destroy = mockState.destroy;
    this.isDestroyed = mockState.isDestroyed;
    this.isVisible = mockState.isVisible;
    this.loadURL = mockState.loadURL;
    this.setVisibleOnAllWorkspaces = mockState.setVisibleOnAllWorkspaces;
    this.setIgnoreMouseEvents = mockState.setIgnoreMouseEvents;  // Fix keyboard focus passthrough
    this.webContents = { on: mockState.webContentsOn };
  };

  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getPrimaryDisplay: () => ({
        workAreaSize: { width: 1920, height: 1080 },
      }),
    },
    ipcMain: {
      on: mockState.ipcMainOn,
    },
  };
});

vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  },
  join: (...args: string[]) => args.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
}));

vi.mock('url', () => ({
  fileURLToPath: (url: string) => url.replace('file://', ''),
}));

// Import after mocking
import { ipcMain } from 'electron';
import {
  showAIContextButton,
  hideAIContextButton,
  destroyAIContextButton,
  isAIContextButtonVisible,
  initAIContextPopupIPC,
} from '../ai-context-popup.js';

describe('AI Context Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    mockState.isDestroyed?.mockReturnValue(false);
    mockState.isVisible?.mockReturnValue(false);
    // Destroy any existing window
    destroyAIContextButton();
    // Clear BrowserWindow constructor call tracking
    mockState.constructorCalls.length = 0;
  });

  afterEach(() => {
    destroyAIContextButton();
  });

  describe('showAIContextButton', () => {
    it('should create a BrowserWindow with correct configuration', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      expect(mockState.constructorCalls.length).toBe(1);
      expect(mockState.constructorCalls[0][0]).toMatchObject({
        width: 48,
        height: 48,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: false,
      });
    });

    it('should position window in bottom-right corner', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      // Screen size: 1920x1080, Button size: 48x48, Margin: 16
      // Expected x: 1920 - 48 - 16 = 1856
      // Expected y: 1080 - 48 - 16 = 1016
      expect(mockState.constructorCalls[0][0]).toMatchObject({
        x: 1856,
        y: 1016,
      });
    });

    it('should load HTML content with data URL', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      expect(mockState.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('data:text/html')
      );
    });

    it('should set window visible on all workspaces', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      expect(mockState.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(
        true,
        { visibleOnFullScreen: false }
      );
    });

    it('should reuse existing window if not destroyed', () => {
      const onClick = vi.fn();

      // First call - creates window
      showAIContextButton(onClick);
      expect(mockState.constructorCalls.length).toBe(1);

      // Mock window exists and not destroyed
      mockState.isDestroyed?.mockReturnValue(false);

      // Second call - should reuse (show instead of creating new)
      showAIContextButton(onClick);
      expect(mockState.constructorCalls.length).toBe(1); // Still 1, not 2
      expect(mockState.show).toHaveBeenCalled();
    });

    it('should register IPC message handler', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      expect(mockState.webContentsOn).toHaveBeenCalledWith(
        'ipc-message',
        expect.any(Function)
      );
    });
  });

  describe('hideAIContextButton', () => {
    it('should hide the floating button window', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(false);
      hideAIContextButton();

      expect(mockState.hide).toHaveBeenCalled();
    });

    it('should not throw if window is already destroyed', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(true);

      expect(() => hideAIContextButton()).not.toThrow();
    });

    it('should not throw if no window exists', () => {
      expect(() => hideAIContextButton()).not.toThrow();
    });
  });

  describe('destroyAIContextButton', () => {
    it('should destroy the floating button window', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(false);
      destroyAIContextButton();

      expect(mockState.destroy).toHaveBeenCalled();
    });

    it('should not throw if window is already destroyed', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(true);

      expect(() => destroyAIContextButton()).not.toThrow();
    });
  });

  describe('isAIContextButtonVisible', () => {
    it('should return false when no window exists', () => {
      expect(isAIContextButtonVisible()).toBe(false);
    });

    it('should return false when window is destroyed', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(true);

      expect(isAIContextButtonVisible()).toBe(false);
    });

    it('should return true when window is visible', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(false);
      mockState.isVisible?.mockReturnValue(true);

      expect(isAIContextButtonVisible()).toBe(true);
    });

    it('should return false when window exists but is hidden', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      mockState.isDestroyed?.mockReturnValue(false);
      mockState.isVisible?.mockReturnValue(false);

      expect(isAIContextButtonVisible()).toBe(false);
    });
  });

  describe('initAIContextPopupIPC', () => {
    it('should register IPC handler for floating-button-click', () => {
      initAIContextPopupIPC();

      expect(ipcMain.on).toHaveBeenCalledWith(
        'floating-button-click',
        expect.any(Function)
      );
    });
  });

  describe('Click Callback', () => {
    it('should invoke callback when button is clicked via IPC message', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      // Get the IPC message handler
      const ipcMessageCall = mockState.webContentsOn?.mock.calls.find(
        (call: unknown[]) => call[0] === 'ipc-message'
      );
      expect(ipcMessageCall).toBeDefined();

      const ipcMessageHandler = ipcMessageCall![1] as (event: unknown, channel: string) => void;

      // Simulate click
      ipcMessageHandler({}, 'floating-button-click');

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not invoke callback for other IPC channels', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      // Get the IPC message handler
      const ipcMessageCall = mockState.webContentsOn?.mock.calls.find(
        (call: unknown[]) => call[0] === 'ipc-message'
      );
      const ipcMessageHandler = ipcMessageCall![1] as (event: unknown, channel: string) => void;

      // Simulate other message
      ipcMessageHandler({}, 'other-channel');

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('HTML Content', () => {
    it('should include pulse animation in CSS', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const loadedUrl = mockState.loadURL?.mock.calls[0][0] as string;
      const htmlContent = decodeURIComponent(loadedUrl.replace('data:text/html;charset=utf-8,', ''));

      expect(htmlContent).toContain('@keyframes pulse');
      expect(htmlContent).toContain('animation: pulse');
    });

    it('should include tooltip in button', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const loadedUrl = mockState.loadURL?.mock.calls[0][0] as string;
      const htmlContent = decodeURIComponent(loadedUrl.replace('data:text/html;charset=utf-8,', ''));

      expect(htmlContent).toContain('title="PromptLint');
    });

    it('should include click event listener script', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const loadedUrl = mockState.loadURL?.mock.calls[0][0] as string;
      const htmlContent = decodeURIComponent(loadedUrl.replace('data:text/html;charset=utf-8,', ''));

      expect(htmlContent).toContain("addEventListener('click'");
      expect(htmlContent).toContain('floating-button-click');
    });

    it('should have proper button styling with gradient', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const loadedUrl = mockState.loadURL?.mock.calls[0][0] as string;
      const htmlContent = decodeURIComponent(loadedUrl.replace('data:text/html;charset=utf-8,', ''));

      expect(htmlContent).toContain('linear-gradient');
      expect(htmlContent).toContain('border-radius: 50%');
    });
  });

  describe('Window Configuration', () => {
    it('should have correct webPreferences configured', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const options = mockState.constructorCalls[0][0] as Record<string, unknown>;
      expect(options.webPreferences).toMatchObject({
        nodeIntegration: false,
        contextIsolation: true,
      });
    });

    it('should have shadow enabled', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      expect(mockState.constructorCalls[0][0]).toMatchObject({
        hasShadow: true,
      });
    });

    it('should set ignore mouse events for keyboard passthrough', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      // Critical: This allows typing in other apps while floating button is visible
      expect(mockState.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    });

    it('should have acceptFirstMouse set to false', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      expect(mockState.constructorCalls[0][0]).toMatchObject({
        acceptFirstMouse: false,
      });
    });
  });

  describe('Keyboard Focus Passthrough', () => {
    it('should have pointer-events: none on body in HTML', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const loadedUrl = mockState.loadURL?.mock.calls[0][0] as string;
      const htmlContent = decodeURIComponent(loadedUrl.replace('data:text/html;charset=utf-8,', ''));

      expect(htmlContent).toContain('pointer-events: none');
    });

    it('should have pointer-events: auto on button in HTML', () => {
      const onClick = vi.fn();
      showAIContextButton(onClick);

      const loadedUrl = mockState.loadURL?.mock.calls[0][0] as string;
      const htmlContent = decodeURIComponent(loadedUrl.replace('data:text/html;charset=utf-8,', ''));

      expect(htmlContent).toContain('pointer-events: auto');
    });
  });
});
