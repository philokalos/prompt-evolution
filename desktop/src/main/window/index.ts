/**
 * Window Module Barrel Export
 * Re-exports all window-related functionality.
 */

// Main window management
export {
  createMainWindow,
  getMainWindow,
  isMainWindowValid,
  showMainWindow,
  hideMainWindow,
  toggleMainWindow,
  sendToRenderer,
  cleanupMainWindow,
  type WindowConfig,
} from './main-window.js';

// Window positioning
export {
  positionWindowNearCursor,
  getDisplayNearPoint,
  getCursorPosition,
} from './positioning.js';

// Global shortcuts
export {
  initShortcuts,
  registerAnalysisShortcut,
  unregisterAllShortcuts,
  isShortcutRegistered,
  type ShortcutDeps,
} from './shortcuts.js';
