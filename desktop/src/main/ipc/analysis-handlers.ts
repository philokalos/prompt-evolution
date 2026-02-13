/**
 * Analysis IPC Handlers
 * Handles prompt analysis, AI variant generation, and session context.
 */

import { ipcMain } from 'electron';
import { resolve } from 'path';
import { homedir } from 'os';
import type { ProviderConfig } from '../prompt-rewriter.js';

const MAX_PROMPT_LENGTH = 50_000;
const MAX_PATH_LENGTH = 500;
const MAX_CATEGORY_LENGTH = 100;

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isValidPath(val: unknown): val is string {
  if (!isNonEmptyString(val)) return false;
  if (val.length > MAX_PATH_LENGTH) return false;
  const resolved = resolve(val);
  const home = homedir();
  return resolved.startsWith(home) || resolved.startsWith('/tmp');
}

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
  ipcMain.handle('analyze-prompt', async (_event, text: unknown) => {
    if (!isNonEmptyString(text) || text.length > MAX_PROMPT_LENGTH) {
      return { error: 'Invalid prompt text' };
    }
    return deps.analyzePrompt(text);
  });

  // Async AI variant loading handler (Phase 3.1)
  ipcMain.handle('get-ai-variant', async (_event, text: unknown) => {
    if (!isNonEmptyString(text) || text.length > MAX_PROMPT_LENGTH) {
      return { error: 'Invalid prompt text' };
    }
    return deps.generateAIVariant(text);
  });

  // Multi-provider AI variant handler (Phase 3.2)
  ipcMain.handle('get-ai-variant-with-providers', async (_event, text: unknown, providerConfigs: unknown) => {
    if (!isNonEmptyString(text) || text.length > MAX_PROMPT_LENGTH) {
      return { error: 'Invalid prompt text' };
    }
    if (!Array.isArray(providerConfigs)) {
      return { error: 'Invalid provider configs' };
    }
    return deps.generateAIVariantWithProviders(text, providerConfigs as ProviderConfig[]);
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
  ipcMain.handle('get-session-context-for-path', async (_event, targetPath: unknown) => {
    if (!isValidPath(targetPath)) {
      return { error: 'Invalid path' };
    }
    return deps.getSessionContextForPath(targetPath);
  });

  // History-based recommendation handlers (Phase 2)
  ipcMain.handle('get-project-patterns', async (_event, projectPath: unknown) => {
    if (!isValidPath(projectPath)) {
      return { error: 'Invalid project path' };
    }
    return deps.analyzeProjectPatterns(projectPath);
  });

  ipcMain.handle('get-context-recommendations', async (_event, category: unknown, projectPath: unknown) => {
    if (category !== undefined && (!isNonEmptyString(category) || category.length > MAX_CATEGORY_LENGTH)) {
      return { error: 'Invalid category' };
    }
    if (projectPath !== undefined && !isValidPath(projectPath)) {
      return { error: 'Invalid project path' };
    }
    return deps.getContextRecommendations(
      category as string | undefined,
      projectPath as string | undefined,
    );
  });
}
