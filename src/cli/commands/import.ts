/**
 * Import Command
 * Import Claude Code sessions to database
 */

import { importToDatabase } from '../services/import-service.js';

export interface ImportCommandOptions {
  project?: string;
  incremental?: boolean;
}

export function importCommand(options: ImportCommandOptions): void {
  importToDatabase(options);
}
