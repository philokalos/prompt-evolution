import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { t, getLanguageInfo, type UserLanguagePreference } from './i18n.js';
import Store from 'electron-store';

const store = new Store();
let tray: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;

// Double-click detection state
let lastClickTime = 0;
let pendingClickTimeout: NodeJS.Timeout | null = null;
const DOUBLE_CLICK_THRESHOLD = 300; // ms

// Callbacks for tray interactions
type TrayCallbacks = {
  onToggleWindow: () => void;
  onDoubleClick?: () => void;
};

let trayCallbacks: TrayCallbacks | null = null;

/**
 * Get the correct assets path for both dev and packaged app
 *
 * In packaged app:
 * - Icons are unpacked to: resources/app.asar.unpacked/assets/icons/
 * - process.resourcesPath points to: /path/to/app/Contents/Resources
 *
 * In development:
 * - Assets are at project root: /path/to/desktop/assets
 * - app.getAppPath() returns: /path/to/desktop
 */
function getAssetsPath(): string {
  if (app.isPackaged) {
    // Packaged app: icons are in app.asar.unpacked (due to asarUnpack config)
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'assets');
  }
  // Development: assets at project root
  return path.join(app.getAppPath(), 'assets');
}

export function createTray(mainWindow: BrowserWindow, callbacks?: TrayCallbacks): Tray {
  // Store reference for menu rebuilding
  mainWindowRef = mainWindow;

  // Store callbacks for use in event handlers
  trayCallbacks = callbacks || {
    onToggleWindow: () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    },
  };
  // Load tray icon from assets
  const assetsPath = getAssetsPath();
  console.log('[Tray] isPackaged:', app.isPackaged);
  console.log('[Tray] resourcesPath:', process.resourcesPath);
  console.log('[Tray] Assets path:', assetsPath);

  // Load the professionally designed template icon
  let trayIcon: Electron.NativeImage;

  if (process.platform === 'darwin') {
    // Use template icon for macOS (auto-adapts to light/dark mode)
    const templatePath = path.join(assetsPath, 'icons/trayTemplate.png');

    if (fs.existsSync(templatePath)) {
      trayIcon = nativeImage.createFromPath(templatePath);
      trayIcon.setTemplateImage(true);
      console.log('[Tray] Template icon loaded:', trayIcon.getSize());
    } else {
      console.warn('[Tray] Template icon not found, using fallback');
      trayIcon = createTemplateIcon();
    }
  } else {
    // Use color icon for Windows/Linux
    const iconPath = path.join(assetsPath, 'icons/tray.png');
    const icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
      console.warn('[Tray] Icon not found at:', iconPath);
      trayIcon = nativeImage.createEmpty();
    } else {
      trayIcon = icon;
    }
  }

  console.log('[Tray] Creating tray with icon size:', trayIcon.getSize());
  console.log('[Tray] Icon isEmpty:', trayIcon.isEmpty());

  // Create tray
  tray = new Tray(trayIcon);
  tray.setToolTip(t('tray:tooltip', { shortcut: '⌘⇧P' }));
  console.log('[Tray] Tray created successfully');

  // Build and set context menu
  buildTrayMenu(mainWindow);

  // Click on tray icon with double-click detection
  tray.on('click', () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;

    // Clear any pending single-click timeout
    if (pendingClickTimeout) {
      clearTimeout(pendingClickTimeout);
      pendingClickTimeout = null;
    }

    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && timeSinceLastClick > 50) {
      // Double-click detected
      console.log('[Tray] Double-click detected');
      lastClickTime = 0; // Reset to prevent triple-click issues

      if (trayCallbacks?.onDoubleClick) {
        trayCallbacks.onDoubleClick();
      } else {
        // Default: toggle window (same as single click)
        trayCallbacks?.onToggleWindow();
      }
    } else {
      // Potential single click - wait to see if it's a double click
      lastClickTime = now;

      pendingClickTimeout = setTimeout(() => {
        console.log('[Tray] Single-click confirmed');
        trayCallbacks?.onToggleWindow();
        pendingClickTimeout = null;
      }, DOUBLE_CLICK_THRESHOLD);
    }
  });

  return tray;
}

function createTemplateIcon(): Electron.NativeImage {
  // Create a simple 16x16 template image for macOS
  // Template images should be black with alpha for proper dark/light mode support
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // Draw a simple "P" shape in the center
  const drawPixel = (x: number, y: number, alpha: number) => {
    const idx = (y * size + x) * 4;
    canvas[idx] = 0;     // R
    canvas[idx + 1] = 0; // G
    canvas[idx + 2] = 0; // B
    canvas[idx + 3] = alpha; // A
  };

  // Simple square indicator
  for (let y = 4; y < 12; y++) {
    for (let x = 4; x < 12; x++) {
      if (y === 4 || y === 11 || x === 4 || x === 11) {
        drawPixel(x, y, 255);
      } else if (x === 5 || x === 6) {
        drawPixel(x, y, 255);
      } else if (y === 5 || y === 6) {
        drawPixel(x, y, 255);
      }
    }
  }

  const image = nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
    scaleFactor: 1,
  });

  // Mark as template for macOS
  image.setTemplateImage(true);

  return image;
}

/**
 * Build the tray context menu with i18n labels
 */
function buildTrayMenu(mainWindow: BrowserWindow): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: t('tray:show'),
      accelerator: 'CommandOrControl+Shift+P',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: t('tray:recentAnalyses'),
      submenu: [
        { label: t('tray:noRecentAnalyses'), enabled: false },
      ],
    },
    {
      label: t('tray:stats.title'),
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('navigate', 'stats');
      },
    },
    {
      label: t('tray:help'),
      submenu: [
        {
          label: t('tray:help'),
          click: () => {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', 'help');
          },
        },
        {
          label: t('tray:showTutorial'),
          click: () => {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('show-onboarding');
          },
        },
        { type: 'separator' },
        {
          label: t('tray:about'),
          click: () => {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('show-about');
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: t('tray:settings'),
      submenu: [
        {
          label: t('common:alwaysOnTop'),
          type: 'checkbox',
          checked: mainWindow.isAlwaysOnTop(),
          click: (menuItem) => {
            mainWindow.setAlwaysOnTop(menuItem.checked);
          },
        },
        {
          label: t('common:openAtLogin'),
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (menuItem) => {
            app.setLoginItemSettings({
              openAtLogin: menuItem.checked,
            });
          },
        },
        { type: 'separator' },
        {
          label: t('tray:language'),
          submenu: [
            {
              label: t('settings:language.auto'),
              type: 'radio',
              checked: (store.get('language') as UserLanguagePreference || 'auto') === 'auto',
              click: () => {
                mainWindow.webContents.send('set-language', 'auto');
              },
            },
            {
              label: t('settings:language.en'),
              type: 'radio',
              checked: (store.get('language') as UserLanguagePreference || 'auto') === 'en',
              click: () => {
                mainWindow.webContents.send('set-language', 'en');
              },
            },
            {
              label: t('settings:language.ko'),
              type: 'radio',
              checked: (store.get('language') as UserLanguagePreference || 'auto') === 'ko',
              click: () => {
                mainWindow.webContents.send('set-language', 'ko');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: t('common:devTools'),
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.openDevTools({ mode: 'detach' });
            }
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: t('tray:quit'),
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Rebuild tray menu with updated language labels
 * Call this after language change
 */
export function rebuildTrayMenu(): void {
  if (!tray || !mainWindowRef) return;

  console.log('[Tray] Rebuilding menu with new language');
  buildTrayMenu(mainWindowRef);

  // Also update tooltip
  tray.setToolTip(t('tray:tooltip', { shortcut: '⌘⇧P' }));
}

export function destroyTray(): void {
  // 대기 중인 클릭 타이머 정리
  if (pendingClickTimeout) {
    clearTimeout(pendingClickTimeout);
    pendingClickTimeout = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
  trayCallbacks = null;
  mainWindowRef = null;
}

export function updateTrayMenu(_recentAnalyses: Array<{ text: string; score: number }>): void {
  // This would update the "최근 분석" submenu with actual data
  // Implementation depends on how we store history
}

/**
 * Set tray badge indicator (macOS only)
 * Shows a small indicator next to the tray icon when a prompt is detected
 */
export function setTrayBadge(show: boolean): void {
  if (!tray) return;

  if (process.platform === 'darwin') {
    // On macOS, use setTitle to show a small indicator next to the icon
    tray.setTitle(show ? '•' : '');
    console.log(`[Tray] Badge ${show ? 'shown' : 'hidden'}`);
  }
  // On Windows/Linux, we could use a different icon or tooltip
  // For now, just update tooltip
  if (show) {
    tray.setToolTip(t('tray:tooltipNewPrompt'));
  } else {
    tray.setToolTip(t('tray:tooltipDefault'));
  }
}

/**
 * Clear tray badge (convenience function)
 */
export function clearTrayBadge(): void {
  setTrayBadge(false);
}
