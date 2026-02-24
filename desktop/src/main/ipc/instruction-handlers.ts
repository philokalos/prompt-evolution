/**
 * Instruction Linter IPC Handlers
 * Handles CLAUDE.md / .cursorrules / copilot-instructions analysis, detection, and generation.
 */

import { ipcMain } from 'electron';
import { resolve } from 'path';
import { homedir } from 'os';
import type { LintResult } from '../instruction-linter/index.js';

const MAX_PATH_LENGTH = 500;
const MAX_CONTENT_LENGTH = 500_000;

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
 * Dependencies for instruction handlers
 */
export interface InstructionHandlerDeps {
  lintFile: (filePath: string) => LintResult;
  saveLintResult: (result: LintResult) => number;
  detectFiles: (projectPath?: string) => unknown[];
  getHistory: (opts: { filePath?: string; limit?: number }) => unknown[];
  generateClaudeMd: (projectPath: string) => unknown;
  saveInstructionFile: (filePath: string, content: string) => { success: boolean; message?: string };
}

/**
 * Register instruction-linter-related IPC handlers
 */
export function registerInstructionHandlers(deps: InstructionHandlerDeps): void {
  // Lint an instruction file
  ipcMain.handle('lint-instruction-file', async (_event, args: { filePath?: unknown }) => {
    const { filePath } = args ?? {};
    if (!isValidPath(filePath)) {
      return { error: 'Invalid file path' };
    }
    const result = deps.lintFile(filePath);
    deps.saveLintResult(result);
    return result;
  });

  // Detect instruction files in a project directory
  ipcMain.handle('detect-instruction-files', async (_event, args: { projectPath?: unknown }) => {
    const { projectPath } = args ?? {};
    if (projectPath !== undefined && !isValidPath(projectPath)) {
      return { error: 'Invalid project path' };
    }
    return deps.detectFiles(projectPath as string | undefined);
  });

  // Get instruction analysis history
  ipcMain.handle('get-instruction-history', async (_event, args: { filePath?: unknown; limit?: unknown }) => {
    const { filePath, limit } = args ?? {};
    if (limit !== undefined && typeof limit !== 'number') {
      return { error: 'Invalid limit' };
    }
    return deps.getHistory({
      filePath: filePath as string | undefined,
      limit: limit as number | undefined,
    });
  });

  // Generate a CLAUDE.md draft for a project
  ipcMain.handle('generate-claude-md', async (_event, args: { projectPath?: unknown }) => {
    const { projectPath } = args ?? {};
    if (!isValidPath(projectPath)) {
      return { error: 'Invalid project path' };
    }
    return deps.generateClaudeMd(projectPath);
  });

  // Save an instruction file
  ipcMain.handle('save-instruction-file', async (_event, args: { filePath?: unknown; content?: unknown }) => {
    const { filePath, content } = args ?? {};
    if (!isValidPath(filePath)) {
      return { error: 'Invalid file path' };
    }
    if (typeof content !== 'string' || content.length === 0 || content.length > MAX_CONTENT_LENGTH) {
      return { error: 'Invalid content' };
    }
    return deps.saveInstructionFile(filePath, content);
  });
}
