/**
 * IPC Handlers: Project Detection & Selection
 */

import { ipcMain } from 'electron';
import { resolve } from 'path';
import { homedir } from 'os';
import type { DetectedProject } from '../active-window-detector.js';

export interface ProjectHandlerDeps {
  getCurrentProject: () => DetectedProject | null;
  setSelectedProjectPath: (path: string | null) => void;
  getSelectedProjectPath: () => string | null;
  detectActiveProject: () => Promise<DetectedProject | null>;
  detectAllOpenProjects: () => Promise<DetectedProject[]>;
  store: { get: (key: string) => unknown; set: (key: string, value: unknown) => void };
}

export function registerProjectHandlers(deps: ProjectHandlerDeps): void {
  const {
    getCurrentProject, setSelectedProjectPath, getSelectedProjectPath,
    detectActiveProject, detectAllOpenProjects, store,
  } = deps;

  ipcMain.handle('get-current-project', async () => {
    const selectedPath = getSelectedProjectPath();
    if (selectedPath) {
      const allProjects = await detectAllOpenProjects();
      const selected = allProjects.find(p => p.projectPath === selectedPath);
      if (selected) {
        return { ...selected, isManual: true };
      }
      // If selected project is no longer open, reset to auto-detect
      setSelectedProjectPath(null);
    }
    const cached = getCurrentProject();
    if (cached) {
      return cached;
    }
    return await detectActiveProject();
  });

  ipcMain.handle('get-all-open-projects', async () => {
    console.log('[Main] get-all-open-projects called');
    const projects = await detectAllOpenProjects();
    console.log('[Main] get-all-open-projects result:', projects.length, 'projects');
    if (projects.length > 0) {
      console.log('[Main] Projects:', projects.map(p => p.projectName));
    }
    return projects;
  });

  ipcMain.handle('select-project', (_event, projectPath: unknown) => {
    if (projectPath !== null && typeof projectPath !== 'string') {
      console.warn('[Main] select-project: Invalid path type');
      return { success: false, error: 'Invalid path type' };
    }

    if (typeof projectPath === 'string') {
      if (projectPath.length > 500) {
        console.warn('[Main] select-project: Path too long');
        return { success: false, error: 'Path too long' };
      }

      // Resolve and validate against path traversal
      const resolved = resolve(projectPath);
      const home = homedir();
      if (!resolved.startsWith(home) && !resolved.startsWith('/tmp')) {
        console.warn('[Main] select-project: Path outside allowed directories');
        return { success: false, error: 'Path outside allowed directories' };
      }

      setSelectedProjectPath(resolved);
      store.set('manualProjectPath', resolved);
      console.log(`[Main] Project selected: ${resolved}`);
      return { success: true };
    }

    setSelectedProjectPath(null);
    store.set('manualProjectPath', '');
    console.log('[Main] Project reset to auto-detect');
    return { success: true };
  });
}
