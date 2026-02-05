/**
 * Analysis IPC Handlers
 * Handles prompt analysis, AI variant generation, and session context.
 */

import { ipcMain } from 'electron';
import type { ProviderConfig } from '../prompt-rewriter.js';

/**
 * Dependencies for analysis handlers
 */
export interface AnalysisHandlerDeps {
  analyzePrompt: (text: string) => Promise<unknown>;
  generateAIVariant: (text: string) => Promise<unknown>;
  generateAIVariantWithProviders: (text: string, providers: ProviderConfig[]) => Promise<unknown>;
  getActiveWindowSessionContext: () => Promise<unknown>;
  getSessionContext: () => Promise<unknown>;
  getSessionContextForPath: (path: string) => Promise<unknown>;
  analyzeProjectPatterns: (projectPath: string) => Promise<unknown>;
  getContextRecommendations: (category: string | undefined, projectPath: string | undefined) => Promise<unknown>;
}

/**
 * Register analysis-related IPC handlers
 *
 * @param deps - Handler dependencies
 */
export function registerAnalysisHandlers(deps: AnalysisHandlerDeps): void {
  // Analyze prompt handler
  ipcMain.handle('analyze-prompt', async (_event, text: string) => {
    return deps.analyzePrompt(text);
  });

  // Async AI variant loading handler (Phase 3.1)
  ipcMain.handle('get-ai-variant', async (_event, text: string) => {
    return deps.generateAIVariant(text);
  });

  // Multi-provider AI variant handler (Phase 3.2)
  ipcMain.handle('get-ai-variant-with-providers', async (_event, text: string, providerConfigs: ProviderConfig[]) => {
    return deps.generateAIVariantWithProviders(text, providerConfigs);
  });

  // Session context handler (active window based)
  ipcMain.handle('get-session-context', async () => {
    return deps.getActiveWindowSessionContext();
  });

  // Legacy session context (app path based)
  ipcMain.handle('get-session-context-legacy', async () => {
    return deps.getSessionContext();
  });

  // Session context for specific path (debugging/testing)
  ipcMain.handle('get-session-context-for-path', async (_event, targetPath: string) => {
    return deps.getSessionContextForPath(targetPath);
  });

  // History-based recommendation handlers (Phase 2)
  ipcMain.handle('get-project-patterns', async (_event, projectPath: string) => {
    return deps.analyzeProjectPatterns(projectPath);
  });

  ipcMain.handle('get-context-recommendations', async (_event, category: string | undefined, projectPath: string | undefined) => {
    return deps.getContextRecommendations(category, projectPath);
  });
}
