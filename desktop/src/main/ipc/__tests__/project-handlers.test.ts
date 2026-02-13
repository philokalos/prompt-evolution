/**
 * Project Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { homedir } from 'os';
import type { ProjectHandlerDeps } from '../project-handlers.js';
import type { DetectedProject } from '../../active-window-detector.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

const HOME = homedir();

describe('Project Handlers', () => {
  let deps: ProjectHandlerDeps;
  let mockStore: { get: Mock; set: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
    };

    deps = {
      getCurrentProject: vi.fn(),
      setSelectedProjectPath: vi.fn(),
      getSelectedProjectPath: vi.fn(),
      detectActiveProject: vi.fn(),
      detectAllOpenProjects: vi.fn(),
      store: mockStore,
    };

    const { registerProjectHandlers } = await import('../project-handlers.js');
    registerProjectHandlers(deps);
  });

  const mockProject: DetectedProject = {
    projectName: 'test-project',
    projectPath: `${HOME}/projects/test-project`,
    confidence: 0.9,
    source: 'vscode',
  };

  describe('get-current-project', () => {
    it('should return manually selected project when available', async () => {
      const allProjects: DetectedProject[] = [mockProject];
      (deps.getSelectedProjectPath as Mock).mockReturnValue(`${HOME}/projects/test-project`);
      (deps.detectAllOpenProjects as Mock).mockResolvedValue(allProjects);

      const handler = mockIpcHandlers.get('get-current-project');
      const result = await handler!();

      expect(result).toEqual({ ...mockProject, isManual: true });
      expect(deps.detectAllOpenProjects).toHaveBeenCalled();
    });

    it('should reset to auto-detect when selected project not found', async () => {
      (deps.getSelectedProjectPath as Mock).mockReturnValue(`${HOME}/projects/missing`);
      (deps.detectAllOpenProjects as Mock).mockResolvedValue([mockProject]);
      (deps.getCurrentProject as Mock).mockReturnValue(mockProject);

      const handler = mockIpcHandlers.get('get-current-project');
      const result = await handler!();

      expect(deps.setSelectedProjectPath).toHaveBeenCalledWith(null);
      expect(result).toEqual(mockProject);
    });

    it('should return cached project when no manual selection', async () => {
      (deps.getSelectedProjectPath as Mock).mockReturnValue(null);
      (deps.getCurrentProject as Mock).mockReturnValue(mockProject);

      const handler = mockIpcHandlers.get('get-current-project');
      const result = await handler!();

      expect(result).toEqual(mockProject);
      expect(deps.detectAllOpenProjects).not.toHaveBeenCalled();
    });

    it('should detect active project when no cached project', async () => {
      (deps.getSelectedProjectPath as Mock).mockReturnValue(null);
      (deps.getCurrentProject as Mock).mockReturnValue(null);
      (deps.detectActiveProject as Mock).mockResolvedValue(mockProject);

      const handler = mockIpcHandlers.get('get-current-project');
      const result = await handler!();

      expect(result).toEqual(mockProject);
      expect(deps.detectActiveProject).toHaveBeenCalled();
    });

    it('should return null when no project detected', async () => {
      (deps.getSelectedProjectPath as Mock).mockReturnValue(null);
      (deps.getCurrentProject as Mock).mockReturnValue(null);
      (deps.detectActiveProject as Mock).mockResolvedValue(null);

      const handler = mockIpcHandlers.get('get-current-project');
      const result = await handler!();

      expect(result).toBeNull();
    });
  });

  describe('get-all-open-projects', () => {
    it('should return all detected projects', async () => {
      const projects: DetectedProject[] = [
        mockProject,
        {
          projectName: 'another-project',
          projectPath: `${HOME}/projects/another`,
          confidence: 0.8,
          source: 'terminal',
        },
      ];
      (deps.detectAllOpenProjects as Mock).mockResolvedValue(projects);

      const handler = mockIpcHandlers.get('get-all-open-projects');
      const result = await handler!();

      expect(result).toEqual(projects);
      expect(deps.detectAllOpenProjects).toHaveBeenCalled();
    });

    it('should return empty array when no projects found', async () => {
      (deps.detectAllOpenProjects as Mock).mockResolvedValue([]);

      const handler = mockIpcHandlers.get('get-all-open-projects');
      const result = await handler!();

      expect(result).toEqual([]);
    });

    it('should handle detection errors gracefully', async () => {
      (deps.detectAllOpenProjects as Mock).mockRejectedValue(new Error('Detection failed'));

      const handler = mockIpcHandlers.get('get-all-open-projects');

      await expect(handler!()).rejects.toThrow('Detection failed');
    });
  });

  describe('select-project', () => {
    it('should select project with valid path', async () => {
      const testPath = `${HOME}/projects/test-project`;
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, testPath);

      expect(deps.setSelectedProjectPath).toHaveBeenCalledWith(testPath);
      expect(mockStore.set).toHaveBeenCalledWith('manualProjectPath', testPath);
      expect(result).toEqual({ success: true });
    });

    it('should reset to auto-detect when path is null', async () => {
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, null);

      expect(deps.setSelectedProjectPath).toHaveBeenCalledWith(null);
      expect(mockStore.set).toHaveBeenCalledWith('manualProjectPath', '');
      expect(result).toEqual({ success: true });
    });

    it('should reject non-string, non-null path', async () => {
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, 123);

      expect(result).toEqual({ success: false, error: 'Invalid path type' });
      expect(deps.setSelectedProjectPath).not.toHaveBeenCalled();
    });

    it('should reject path that is too long', async () => {
      const longPath = 'a'.repeat(501);
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, longPath);

      expect(result).toEqual({ success: false, error: 'Path too long' });
      expect(deps.setSelectedProjectPath).not.toHaveBeenCalled();
    });

    it('should reject path outside allowed directories', async () => {
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, '/etc/passwd');

      expect(result).toEqual({ success: false, error: 'Path outside allowed directories' });
      expect(deps.setSelectedProjectPath).not.toHaveBeenCalled();
    });

    it('should accept path with spaces under home', async () => {
      const testPath = `${HOME}/my projects/test app`;
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, testPath);

      expect(result).toEqual({ success: true });
      expect(deps.setSelectedProjectPath).toHaveBeenCalled();
    });

    it('should accept path with dots and dashes under home', async () => {
      const testPath = `${HOME}/my-project.v2/src`;
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, testPath);

      expect(result).toEqual({ success: true });
      expect(deps.setSelectedProjectPath).toHaveBeenCalled();
    });

    it('should reject path traversal attempts', async () => {
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, `${HOME}/../../etc/passwd`);

      expect(result).toEqual({ success: false, error: 'Path outside allowed directories' });
      expect(deps.setSelectedProjectPath).not.toHaveBeenCalled();
    });

    it('should accept tmp path', async () => {
      const handler = mockIpcHandlers.get('select-project');
      const result = await handler!(null, '/tmp/test-project');

      expect(result).toEqual({ success: true });
      expect(deps.setSelectedProjectPath).toHaveBeenCalled();
    });
  });

  describe('IPC registration', () => {
    it('should register all project handlers', () => {
      expect(mockIpcHandlers.has('get-current-project')).toBe(true);
      expect(mockIpcHandlers.has('get-all-open-projects')).toBe(true);
      expect(mockIpcHandlers.has('select-project')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(3);
    });
  });
});
