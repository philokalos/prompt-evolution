/**
 * IPC Handler Registration Barrel
 * Registers all extracted IPC handlers with their dependencies.
 */

export { registerSettingsHandlers, type SettingsHandlerDeps } from './settings-handlers.js';
export { registerClipboardHandlers, type ClipboardHandlerDeps } from './clipboard-handlers.js';
export { registerWindowHandlers, type WindowHandlerDeps } from './window-handlers.js';
export { registerProjectHandlers, type ProjectHandlerDeps } from './project-handlers.js';
export { registerProviderHandlers, type ProviderHandlerDeps } from './provider-handlers.js';
export { registerAnalysisHandlers, type AnalysisHandlerDeps } from './analysis-handlers.js';
export { registerHistoryHandlers, type HistoryHandlerDeps } from './history-handlers.js';
