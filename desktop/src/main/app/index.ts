/**
 * App Module Barrel Export
 * Re-exports all app lifecycle and polling functionality.
 */

// Lifecycle management
export {
  isAppQuitting,
  setAppQuitting,
  showNotification,
  showWelcomeMessage,
  registerLifecycleHandlers,
  setupSingleInstance,
  type CleanupDeps,
} from './lifecycle.js';

// Polling management
export {
  getCurrentProject,
  createProjectChangeHandler,
  initProjectPolling,
  createClipboardHandler,
  initClipboardWatch,
  createAIAppChangeHandler,
  initAIContextPolling,
  stopAllPolling,
  type PollingDeps,
} from './polling.js';
