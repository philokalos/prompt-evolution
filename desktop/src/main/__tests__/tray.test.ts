/**
 * Tests for tray.ts
 * PromptLint - System tray management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock state
const mockState = vi.hoisted(() => {
  const trayInstance = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    setTitle: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    platform: 'darwin' as string,
    iconExists: true,
    trayInstance,
    menuInstance: {},
    nativeImageInstance: {
      isEmpty: vi.fn(() => false),
      getSize: vi.fn(() => ({ width: 16, height: 16 })),
      setTemplateImage: vi.fn(),
    },
    emptyImageInstance: {
      isEmpty: vi.fn(() => true),
      getSize: vi.fn(() => ({ width: 0, height: 0 })),
      setTemplateImage: vi.fn(),
    },
    mainWindow: {
      isVisible: vi.fn(() => false),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      isAlwaysOnTop: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      webContents: {
        send: vi.fn(),
      },
    },
    loginItemSettings: { openAtLogin: false },
    clickHandler: null as ((...args: unknown[]) => void) | null,
  };
});

// Mock electron with Tray as a constructor
vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    getLoginItemSettings: vi.fn(() => mockState.loginItemSettings),
    setLoginItemSettings: vi.fn(),
    isPackaged: false,
    getAppPath: vi.fn(() => '/mock/app/path'),
  },
  Tray: vi.fn(function (this: unknown) {
    // Constructor function pattern
    return mockState.trayInstance;
  }),
  Menu: {
    buildFromTemplate: vi.fn(() => mockState.menuInstance),
  },
  nativeImage: {
    createFromPath: vi.fn(() => {
      if (mockState.iconExists) {
        return mockState.nativeImageInstance;
      }
      return mockState.emptyImageInstance;
    }),
    createFromBuffer: vi.fn(() => mockState.nativeImageInstance),
    createEmpty: vi.fn(() => mockState.emptyImageInstance),
  },
  BrowserWindow: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => mockState.iconExists),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.replace(/\/[^/]+$/, '')),
}));

// Mock url module
vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/mock/path/dist/main/tray.js'),
}));

// Mock i18n module - return the key as-is for easier testing
vi.mock('../i18n.js', () => ({
  t: vi.fn((key: string) => key),
}));

// Store original platform
const originalPlatform = process.platform;

// Import after mocking
import { createTray, destroyTray, setTrayBadge, clearTrayBadge } from '../tray.js';
import { app, Menu, nativeImage, Tray } from 'electron';

describe('tray', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Reset mock state
    mockState.platform = 'darwin';
    mockState.iconExists = true;
    mockState.loginItemSettings = { openAtLogin: false };
    mockState.clickHandler = null;

    // Reset tray module state by destroying existing tray
    destroyTray();

    // Mock process.platform
    Object.defineProperty(process, 'platform', {
      value: mockState.platform,
      configurable: true,
    });

    // Capture click handler when tray.on is called
    mockState.trayInstance.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'click') {
        mockState.clickHandler = handler;
      }
    });
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    vi.useRealTimers();
  });

  describe('createTray', () => {
    it('should create tray with icon on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      mockState.iconExists = true;

      const _tray = createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(Tray).toHaveBeenCalled();
      expect(nativeImage.createFromPath).toHaveBeenCalledWith(
        expect.stringContaining('trayTemplate.png')
      );
      expect(mockState.nativeImageInstance.setTemplateImage).toHaveBeenCalledWith(true);
      expect(mockState.trayInstance.setToolTip).toHaveBeenCalledWith('tray:tooltip');
    });

    it('should use fallback icon when file not found on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      mockState.iconExists = false;

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(nativeImage.createFromBuffer).toHaveBeenCalled();
    });

    it('should create tray with color icon on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockState.iconExists = true;

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(nativeImage.createFromPath).toHaveBeenCalledWith(
        expect.stringContaining('tray.png')
      );
    });

    it('should create empty icon when file not found on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockState.iconExists = false;

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(nativeImage.createEmpty).toHaveBeenCalled();
    });

    it('should build context menu with correct items', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'tray:show' }),
          expect.objectContaining({ label: 'tray:recentAnalyses' }),
          expect.objectContaining({ label: 'tray:stats.title' }),
          expect.objectContaining({ label: 'tray:settings' }),
          expect.objectContaining({ label: 'tray:quit' }),
        ])
      );
    });

    it('should set context menu on tray', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(mockState.trayInstance.setContextMenu).toHaveBeenCalledWith(mockState.menuInstance);
    });

    it('should register click handler on tray', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(mockState.trayInstance.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should use default toggle callback when none provided', () => {
      vi.useFakeTimers();
      mockState.mainWindow.isVisible.mockReturnValue(false);

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      // Simulate single click
      if (mockState.clickHandler) {
        mockState.clickHandler();
        vi.advanceTimersByTime(350); // After DOUBLE_CLICK_THRESHOLD
      }

      expect(mockState.mainWindow.show).toHaveBeenCalled();
      expect(mockState.mainWindow.focus).toHaveBeenCalled();
    });

    it('should hide window on single click when visible', () => {
      vi.useFakeTimers();
      mockState.mainWindow.isVisible.mockReturnValue(true);

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      // Simulate single click
      if (mockState.clickHandler) {
        mockState.clickHandler();
        vi.advanceTimersByTime(350);
      }

      expect(mockState.mainWindow.hide).toHaveBeenCalled();
    });

    it('should call custom onToggleWindow callback', () => {
      vi.useFakeTimers();
      const onToggleWindow = vi.fn();

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow, {
        onToggleWindow,
      });

      // Simulate single click
      if (mockState.clickHandler) {
        mockState.clickHandler();
        vi.advanceTimersByTime(350);
      }

      expect(onToggleWindow).toHaveBeenCalled();
    });

    it('should detect double-click and call onDoubleClick callback', () => {
      vi.useFakeTimers();
      const onToggleWindow = vi.fn();
      const onDoubleClick = vi.fn();

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow, {
        onToggleWindow,
        onDoubleClick,
      });

      // Simulate double click
      if (mockState.clickHandler) {
        mockState.clickHandler(); // First click
        vi.advanceTimersByTime(100); // Less than DOUBLE_CLICK_THRESHOLD
        mockState.clickHandler(); // Second click
      }

      expect(onDoubleClick).toHaveBeenCalled();
      expect(onToggleWindow).not.toHaveBeenCalled();
    });

    it('should fall back to onToggleWindow when double-click without onDoubleClick callback', () => {
      vi.useFakeTimers();
      const onToggleWindow = vi.fn();

      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow, {
        onToggleWindow,
        // No onDoubleClick callback
      });

      // Simulate double click
      if (mockState.clickHandler) {
        mockState.clickHandler(); // First click
        vi.advanceTimersByTime(100);
        mockState.clickHandler(); // Second click
      }

      expect(onToggleWindow).toHaveBeenCalled();
    });

    it('should return the tray instance', () => {
      const tray = createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      expect(tray).toBe(mockState.trayInstance);
    });
  });

  describe('context menu actions', () => {
    it('should show window when "Show" clicked', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const openItem = template.find((item: { label?: string }) => item.label === 'tray:show');
      openItem.click();

      expect(mockState.mainWindow.show).toHaveBeenCalled();
      expect(mockState.mainWindow.focus).toHaveBeenCalled();
    });

    it('should navigate to stats when "Stats" clicked', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const statsItem = template.find((item: { label?: string }) => item.label === 'tray:stats.title');
      statsItem.click();

      expect(mockState.mainWindow.webContents.send).toHaveBeenCalledWith('navigate', 'stats');
    });

    it('should quit app when "Quit" clicked', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const quitItem = template.find((item: { label?: string }) => item.label === 'tray:quit');
      quitItem.click();

      expect(app.quit).toHaveBeenCalled();
    });

    it('should toggle always on top when checkbox clicked', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const settingsItem = template.find((item: { label?: string }) => item.label === 'tray:settings');
      const alwaysOnTopItem = settingsItem.submenu.find(
        (item: { label?: string }) => item.label === 'common:alwaysOnTop'
      );
      alwaysOnTopItem.click({ checked: true });

      expect(mockState.mainWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    });

    it('should toggle login item when checkbox clicked', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      const template = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const settingsItem = template.find((item: { label?: string }) => item.label === 'tray:settings');
      const loginItem = settingsItem.submenu.find(
        (item: { label?: string }) => item.label === 'common:openAtLogin'
      );
      loginItem.click({ checked: true });

      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    });
  });

  describe('destroyTray', () => {
    it('should destroy tray if it exists', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);
      destroyTray();

      expect(mockState.trayInstance.destroy).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls gracefully', () => {
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      // Clear any previous destroy calls
      mockState.trayInstance.destroy.mockClear();

      destroyTray();
      destroyTray(); // Should not throw

      // Should only be called once (second call is no-op since tray is null)
      expect(mockState.trayInstance.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setTrayBadge', () => {
    it('should show badge on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      setTrayBadge(true);

      expect(mockState.trayInstance.setTitle).toHaveBeenCalledWith('•');
      expect(mockState.trayInstance.setToolTip).toHaveBeenCalledWith(
        'tray:tooltipNewPrompt'
      );
    });

    it('should hide badge on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      setTrayBadge(false);

      expect(mockState.trayInstance.setTitle).toHaveBeenCalledWith('');
      expect(mockState.trayInstance.setToolTip).toHaveBeenCalledWith('tray:tooltipDefault');
    });

    it('should update tooltip only on non-macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);
      mockState.trayInstance.setTitle.mockClear();

      setTrayBadge(true);

      expect(mockState.trayInstance.setTitle).not.toHaveBeenCalled();
      expect(mockState.trayInstance.setToolTip).toHaveBeenCalledWith(
        'tray:tooltipNewPrompt'
      );
    });
  });

  describe('clearTrayBadge', () => {
    it('should call setTrayBadge with false', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      createTray(mockState.mainWindow as unknown as Electron.BrowserWindow);

      clearTrayBadge();

      expect(mockState.trayInstance.setTitle).toHaveBeenCalledWith('');
      expect(mockState.trayInstance.setToolTip).toHaveBeenCalledWith('tray:tooltipDefault');
    });
  });
});
