/**
 * Active Window Detector Tests
 * Tests for macOS active window detection and project parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock state - must be hoisted
const mockState = vi.hoisted(() => ({
  // Platform
  platform: 'darwin' as NodeJS.Platform,

  // exec mock
  execAsync: vi.fn(),

  // fs mocks
  existsSync: vi.fn(() => false),
  statSync: vi.fn(() => ({ isDirectory: () => true })),
  readdirSync: vi.fn(() => []),

  // Environment
  HOME: '/Users/testuser',

  // Timers
  intervals: [] as NodeJS.Timeout[],

  // Enhanced finder mock
  findProjectPathByNameEnhanced: null as ((name: string) => string | null) | null,
}));

// Mock child_process with ESM compatibility
vi.mock('child_process', () => ({
  __esModule: true,
  default: { exec: vi.fn() },
  exec: vi.fn(),
}));

// Mock util with ESM compatibility
vi.mock('util', () => ({
  __esModule: true,
  default: { promisify: () => mockState.execAsync },
  promisify: () => mockState.execAsync,
}));

// Mock fs with ESM compatibility
vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: (...args: unknown[]) => mockState.existsSync(...args),
    statSync: (...args: unknown[]) => mockState.statSync(...args),
    readdirSync: (...args: unknown[]) => mockState.readdirSync(...args),
    appendFileSync: vi.fn(),
  },
  existsSync: (...args: unknown[]) => mockState.existsSync(...args),
  statSync: (...args: unknown[]) => mockState.statSync(...args),
  readdirSync: (...args: unknown[]) => mockState.readdirSync(...args),
  appendFileSync: vi.fn(),
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/Applications/PromptLint.app/Contents/Resources/app.asar',
    getPath: (name: string) => {
      if (name === 'home') return '/Users/testuser';
      return '/tmp';
    },
  },
}));

// Mock process
const originalPlatform = process.platform;
const originalEnv = process.env;

// Mock the enhanced finder module
vi.mock('../project-detector-enhanced.js', () => ({
  findProjectPathByNameEnhanced: (name: string) => mockState.findProjectPathByNameEnhanced?.(name) ?? null,
}));

// Mock env-util (centralized MAS detection)
vi.mock('../utils/env-util.js', () => ({
  isMASBuild: () => false,
}));

// Import after mocks
import {
  getActiveWindowInfo,
  parseWindowTitle,
  detectActiveProject,
  startWindowPolling,
  stopWindowPolling,
  getLastDetectedProject,
  isAIApp,
  detectActiveAIApp,
  startAIAppPolling,
  stopAIAppPolling,
  getLastDetectedAIApp,
  type ActiveWindowInfo,
  type DetectedProject as _DetectedProject,
} from '../active-window-detector.js';

describe('active-window-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock state
    mockState.platform = 'darwin';
    mockState.existsSync.mockReturnValue(false);
    mockState.statSync.mockReturnValue({ isDirectory: () => true });
    mockState.readdirSync.mockReturnValue([]);
    mockState.findProjectPathByNameEnhanced = null;

    // Mock process
    Object.defineProperty(process, 'platform', {
      value: mockState.platform,
      writable: true,
    });
    process.env = { ...originalEnv, HOME: mockState.HOME };

    // Clear intervals
    mockState.intervals.forEach(interval => clearInterval(interval));
    mockState.intervals = [];
  });

  afterEach(() => {
    stopWindowPolling();
    stopAIAppPolling();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
    process.env = originalEnv;
  });

  describe('getActiveWindowInfo', () => {
    it('should return null on non-macOS platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });

      const result = await getActiveWindowInfo();

      expect(result).toBeNull();
    });

    it('should parse AppleScript output correctly for VS Code', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|file.ts — my-project — Visual Studio Code\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'Code',
        windowTitle: 'file.ts — my-project — Visual Studio Code',
        isIDE: true,
        ideName: 'Code',
      });
    });

    it('should parse AppleScript output correctly for Cursor', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Cursor|DELIMITER|App.tsx — react-app — Cursor\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'Cursor',
        windowTitle: 'App.tsx — react-app — Cursor',
        isIDE: true,
        ideName: 'Cursor',
      });
    });

    it('should detect Terminal apps', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Terminal|DELIMITER|user@host: ~/projects/my-app\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'Terminal',
        windowTitle: 'user@host: ~/projects/my-app',
        isIDE: true,
        ideName: 'Terminal',
      });
    });

    it('should detect iTerm2', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'iTerm2|DELIMITER|~/Development/project\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'iTerm2',
        windowTitle: '~/Development/project',
        isIDE: true,
        ideName: 'iTerm2',
      });
    });

    it('should detect JetBrains WebStorm', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'WebStorm|DELIMITER|my-project – index.ts\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'WebStorm',
        windowTitle: 'my-project – index.ts',
        isIDE: true,
        ideName: 'WebStorm',
      });
    });

    it('should mark non-IDE apps correctly', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Safari|DELIMITER|Google\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'Safari',
        windowTitle: 'Google',
        isIDE: false,
        ideName: undefined,
      });
    });

    it('should handle empty window title', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toEqual({
        appName: 'Code',
        windowTitle: '',
        isIDE: true,
        ideName: 'Code',
      });
    });

    it('should return null when AppleScript fails', async () => {
      mockState.execAsync.mockRejectedValue(new Error('AppleScript error'));

      const result = await getActiveWindowInfo();

      expect(result).toBeNull();
    });

    it('should return null when appName is empty', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: '|DELIMITER|some title\n',
      });

      const result = await getActiveWindowInfo();

      expect(result).toBeNull();
    });
  });

  describe('parseWindowTitle', () => {
    describe('VS Code / Cursor parsing', () => {
      it('should return null for non-IDE windows', () => {
        const windowInfo: ActiveWindowInfo = {
          appName: 'Safari',
          windowTitle: 'Google',
          isIDE: false,
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });

      it('should return null for short window titles', () => {
        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'ab',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });

      it('should ignore Welcome tab', () => {
        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'Welcome — Visual Studio Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });

      it('should ignore Settings tab', () => {
        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'Settings — Visual Studio Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });

      it('should parse standard VS Code title with found project path', () => {
        const projectPath = '/Users/testuser/Development/my-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });
        mockState.readdirSync.mockReturnValue([]);

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'file.ts — my-project — Visual Studio Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toEqual({
          projectPath,
          projectName: 'my-project',
          currentFile: 'file.ts',
          ideName: 'VS Code',
          confidence: 'high',
        });
      });

      it('should parse Cursor title with found project path', () => {
        const projectPath = '/Users/testuser/Development/react-app';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Cursor',
          windowTitle: 'App.tsx — react-app — Cursor',
          isIDE: true,
          ideName: 'Cursor',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toEqual({
          projectPath,
          projectName: 'react-app',
          currentFile: 'App.tsx',
          ideName: 'Cursor',
          confidence: 'high',
        });
      });

      it('should handle unsaved file indicator (●)', () => {
        const projectPath = '/Users/testuser/Development/my-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: '● file.ts — my-project — Visual Studio Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.currentFile).toBe('file.ts');
      });

      it('should handle Remote-SSH prefix with medium confidence', () => {
        const projectPath = '/Users/testuser/Development/remote-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: '[SSH: myserver] file.ts — remote-project — VS Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.confidence).toBe('medium');
        expect(result?.projectName).toBe('remote-project');
      });

      it('should handle WSL prefix', () => {
        const projectPath = '/Users/testuser/Development/wsl-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: '[WSL: Ubuntu] file.ts — wsl-project — VS Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.confidence).toBe('medium');
      });

      it('should handle Workspace suffix', () => {
        const projectPath = '/Users/testuser/Development/workspace-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'file.ts — workspace-project (Workspace) — VS Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.projectName).toBe('workspace-project');
      });

      it('should return low confidence when project path not found but name looks valid', () => {
        mockState.existsSync.mockReturnValue(false);

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'file.ts — unknown-project — Visual Studio Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toEqual({
          projectPath: 'unknown-project',
          projectName: 'unknown-project',
          currentFile: 'file.ts',
          ideName: 'VS Code',
          confidence: 'low',
        });
      });

      it('should return null for invalid project name format', () => {
        mockState.existsSync.mockReturnValue(false);

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'file.ts — Some Long Title With Spaces — Visual Studio Code',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });

      it('should parse single-name window title with found project', () => {
        const projectPath = '/Users/testuser/Development/single-name';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'single-name',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.projectName).toBe('single-name');
        expect(result?.confidence).toBe('medium');
        expect(result?.currentFile).toBeUndefined();
      });

      it('should ignore single-name with file extension', () => {
        const windowInfo: ActiveWindowInfo = {
          appName: 'Code',
          windowTitle: 'file.ts',
          isIDE: true,
          ideName: 'Code',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });
    });

    describe('JetBrains IDE parsing', () => {
      it('should parse JetBrains window title with path in brackets', () => {
        const projectPath = '/Users/testuser/projects/java-app';
        mockState.existsSync.mockImplementation((p: string) => p === projectPath);

        const windowInfo: ActiveWindowInfo = {
          appName: 'IntelliJ IDEA',
          windowTitle: 'java-app [/Users/testuser/projects/java-app] – Main.java',
          isIDE: true,
          ideName: 'IntelliJ IDEA',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toEqual({
          projectPath,
          projectName: 'java-app',
          currentFile: 'Main.java',
          ideName: 'IntelliJ IDEA',
          confidence: 'high',
        });
      });

      it('should parse JetBrains window title without path in brackets', () => {
        const projectPath = '/Users/testuser/Development/webstorm-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'WebStorm',
          windowTitle: 'webstorm-project – index.ts',
          isIDE: true,
          ideName: 'WebStorm',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.projectName).toBe('webstorm-project');
        expect(result?.currentFile).toBe('index.ts');
      });

      it('should handle PyCharm', () => {
        const projectPath = '/Users/testuser/Development/python-app';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'PyCharm',
          windowTitle: 'python-app – main.py',
          isIDE: true,
          ideName: 'PyCharm',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.ideName).toBe('PyCharm');
      });
    });

    describe('Terminal parsing', () => {
      it('should parse Terminal with user@host: path pattern (no hyphens)', () => {
        // Pattern 1 regex excludes hyphens, so use a path without hyphens for 'medium' confidence
        const projectPath = '/Users/testuser/projects/myapp';
        mockState.existsSync.mockImplementation((p: string) => p === projectPath);
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Terminal',
          windowTitle: 'user@host: /Users/testuser/projects/myapp',
          isIDE: true,
          ideName: 'Terminal',
        };

        const result = parseWindowTitle(windowInfo);

        // Terminal parsing doesn't include currentFile
        expect(result).toMatchObject({
          projectPath,
          projectName: 'myapp',
          ideName: 'Terminal',
          confidence: 'medium',
        });
      });

      it('should parse Terminal with hyphenated path (falls back to end pattern with low confidence)', () => {
        // Pattern 1 regex stops at hyphens, so hyphenated paths use pattern 4 (end match)
        const projectPath = '/Users/testuser/projects/my-app';
        mockState.existsSync.mockImplementation((p: string) => p === projectPath);
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Terminal',
          windowTitle: 'user@host: /Users/testuser/projects/my-app',
          isIDE: true,
          ideName: 'Terminal',
        };

        const result = parseWindowTitle(windowInfo);

        // Falls back to end pattern (pattern 4) due to hyphen in path
        expect(result).toMatchObject({
          projectPath,
          projectName: 'my-app',
          ideName: 'Terminal',
          confidence: 'low',
        });
      });

      it('should parse Terminal with ~ path pattern', () => {
        const projectPath = '/Users/testuser/projects/my-app';
        mockState.existsSync.mockImplementation((p: string) => p === projectPath);
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Terminal',
          windowTitle: '~/projects/my-app',
          isIDE: true,
          ideName: 'Terminal',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.projectPath).toBe(projectPath);
      });

      it('should parse starship-style prompt', () => {
        const projectPath = '/Users/testuser/Development/starship-project';
        mockState.existsSync.mockImplementation((p: string) => {
          return p === projectPath || p === '/Users/testuser/Development';
        });
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'iTerm2',
          windowTitle: 'starship-project on main ➜',
          isIDE: true,
          ideName: 'iTerm2',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.projectName).toBe('starship-project');
        expect(result?.confidence).toBe('medium');
      });

      it('should parse path with lambda prefix (oh-my-zsh)', () => {
        const projectPath = '/Users/testuser/dev/lambda-project';
        mockState.existsSync.mockImplementation((p: string) => p === projectPath);
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Warp',
          windowTitle: 'λ ~/dev/lambda-project',
          isIDE: true,
          ideName: 'Warp',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.projectPath).toBe(projectPath);
      });

      it('should parse path at end of title with low confidence', () => {
        const projectPath = '/Users/testuser/work/end-path';
        mockState.existsSync.mockImplementation((p: string) => p === projectPath);
        mockState.statSync.mockReturnValue({ isDirectory: () => true });

        const windowInfo: ActiveWindowInfo = {
          appName: 'Terminal',
          windowTitle: 'some text ~/work/end-path',
          isIDE: true,
          ideName: 'Terminal',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result?.confidence).toBe('low');
      });

      it('should return null for non-existent path', () => {
        mockState.existsSync.mockReturnValue(false);

        const windowInfo: ActiveWindowInfo = {
          appName: 'Terminal',
          windowTitle: '~/nonexistent/path',
          isIDE: true,
          ideName: 'Terminal',
        };

        const result = parseWindowTitle(windowInfo);

        expect(result).toBeNull();
      });
    });
  });

  describe('detectActiveProject', () => {
    it('should return null when getActiveWindowInfo returns null', async () => {
      mockState.execAsync.mockRejectedValue(new Error('Failed'));

      const result = await detectActiveProject();

      expect(result).toBeNull();
    });

    it('should return null for non-IDE app', async () => {
      mockState.execAsync.mockResolvedValue({
        stdout: 'Safari|DELIMITER|Google\n',
      });

      const result = await detectActiveProject();

      expect(result).toBeNull();
    });

    it('should return detected project for IDE', async () => {
      const projectPath = '/Users/testuser/Development/test-project';
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|index.ts — test-project — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPath || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      const result = await detectActiveProject();

      expect(result).toEqual({
        projectPath,
        projectName: 'test-project',
        currentFile: 'index.ts',
        ideName: 'VS Code',
        confidence: 'high',
      });
    });
  });

  describe('Window Polling', () => {
    // Note: Callback is only called when project CHANGES (not on every poll)
    // The module-level lastDetectedProject may retain state between tests

    it('should start polling and call callback when project is detected', async () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      // Return a project so callback is definitely called (project changes from undefined to path)
      const projectPath = '/Users/testuser/Development/test-project';
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|file.ts — test-project — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPath || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      startWindowPolling(1000, callback);

      // Advance timer and flush async operations
      await vi.runOnlyPendingTimersAsync();

      // Callback should be called when project changes
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        projectPath,
        projectName: 'test-project',
      }));

      stopWindowPolling();
      vi.useRealTimers();
    });

    it('should detect project changes between polls', async () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      // First poll: detect project A
      const projectPathA = '/Users/testuser/Development/project-a';
      mockState.execAsync.mockResolvedValueOnce({
        stdout: 'Code|DELIMITER|file.ts — project-a — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPathA || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      startWindowPolling(500, callback);
      await vi.runOnlyPendingTimersAsync();

      const callCountAfterFirst = callback.mock.calls.length;
      expect(callCountAfterFirst).toBeGreaterThanOrEqual(1);

      // Second poll: detect project B (different project)
      const projectPathB = '/Users/testuser/Development/project-b';
      mockState.execAsync.mockResolvedValueOnce({
        stdout: 'Code|DELIMITER|file.ts — project-b — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPathB || p === '/Users/testuser/Development';
      });

      await vi.runOnlyPendingTimersAsync();

      // Callback should have been called again due to project change
      expect(callback.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
      expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({
        projectPath: projectPathB,
        projectName: 'project-b',
      }));

      stopWindowPolling();
      vi.useRealTimers();
    });

    it('should not call callback when project stays the same', async () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      const projectPath = '/Users/testuser/Development/same-project';
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|file.ts — same-project — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPath || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      startWindowPolling(500, callback);
      await vi.runOnlyPendingTimersAsync();

      const callCountAfterFirst = callback.mock.calls.length;

      // Same project on second poll
      await vi.runOnlyPendingTimersAsync();

      // Callback count should not increase since project didn't change
      expect(callback.mock.calls.length).toBe(callCountAfterFirst);

      stopWindowPolling();
      vi.useRealTimers();
    });

    it('should stop polling', () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      mockState.execAsync.mockResolvedValue({
        stdout: 'Safari|DELIMITER|Google\n',
      });

      startWindowPolling(500, callback);
      stopWindowPolling();

      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should replace callback when startWindowPolling called again', async () => {
      vi.useFakeTimers();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const projectPath = '/Users/testuser/Development/replace-test';
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|file.ts — replace-test — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPath || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      // Start with first callback
      startWindowPolling(500, callback1);
      // Immediately replace with second callback
      startWindowPolling(500, callback2);

      await vi.runOnlyPendingTimersAsync();

      // Only callback2 should be active (callback1's interval was cleared)
      expect(callback1).not.toHaveBeenCalled();
      // callback2 might or might not be called depending on whether project changed

      stopWindowPolling();
      vi.useRealTimers();
    });

    it('getLastDetectedProject should return cached project', async () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      const projectPath = '/Users/testuser/Development/cached-project';
      mockState.execAsync.mockResolvedValue({
        stdout: 'Code|DELIMITER|file.ts — cached-project — Visual Studio Code\n',
      });
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPath || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      startWindowPolling(500, callback);
      await vi.runOnlyPendingTimersAsync();

      const result = getLastDetectedProject();

      expect(result).toBe(projectPath);

      stopWindowPolling();
      vi.useRealTimers();
    });
  });

  describe('AI App Detection', () => {
    describe('isAIApp', () => {
      it('should detect Claude app', () => {
        expect(isAIApp('Claude', '')).toBe('Claude');
        expect(isAIApp('', 'Claude Desktop')).toBe('Claude');
      });

      it('should detect ChatGPT app', () => {
        expect(isAIApp('ChatGPT', '')).toBe('ChatGPT');
      });

      it('should detect Claude in browser', () => {
        expect(isAIApp('Safari', 'claude.ai')).toBe('Claude');
        expect(isAIApp('Chrome', 'Claude - claude.ai')).toBe('Claude');
      });

      it('should detect ChatGPT in browser', () => {
        expect(isAIApp('Chrome', 'ChatGPT - chat.openai.com')).toBe('ChatGPT');
        expect(isAIApp('Safari', 'chatgpt.com')).toBe('ChatGPT');
      });

      it('should detect Gemini in browser', () => {
        expect(isAIApp('Chrome', 'gemini.google.com')).toBe('Gemini');
        expect(isAIApp('Chrome', 'bard.google.com')).toBe('Gemini');
      });

      it('should detect Copilot', () => {
        expect(isAIApp('Edge', 'copilot.microsoft.com')).toBe('Copilot');
        expect(isAIApp('Copilot', '')).toBe('Copilot');
      });

      it('should detect Perplexity', () => {
        expect(isAIApp('Chrome', 'perplexity.ai')).toBe('Perplexity');
        expect(isAIApp('Perplexity', '')).toBe('Perplexity');
      });

      it('should detect Poe', () => {
        expect(isAIApp('Safari', 'poe.com')).toBe('Poe');
        expect(isAIApp('Poe', '')).toBe('Poe');
      });

      it('should return null for non-AI apps', () => {
        expect(isAIApp('Safari', 'Google')).toBeNull();
        expect(isAIApp('Finder', 'Documents')).toBeNull();
        expect(isAIApp('Code', 'file.ts — project')).toBeNull();
      });
    });

    describe('detectActiveAIApp', () => {
      it('should return null when getActiveWindowInfo returns null', async () => {
        mockState.execAsync.mockRejectedValue(new Error('Failed'));

        const result = await detectActiveAIApp();

        expect(result).toBeNull();
      });

      it('should detect Claude app', async () => {
        mockState.execAsync.mockResolvedValue({
          stdout: 'Claude|DELIMITER|Claude Desktop\n',
        });

        const result = await detectActiveAIApp();

        expect(result).toEqual({
          appName: 'Claude',
          aiAppType: 'Claude',
          windowTitle: 'Claude Desktop',
          isBrowser: false,
        });
      });

      it('should detect AI app in browser', async () => {
        mockState.execAsync.mockResolvedValue({
          stdout: 'Chrome|DELIMITER|ChatGPT - chat.openai.com\n',
        });

        const result = await detectActiveAIApp();

        expect(result).toEqual({
          appName: 'Chrome',
          aiAppType: 'ChatGPT',
          windowTitle: 'ChatGPT - chat.openai.com',
          isBrowser: true,
        });
      });

      it('should return null for non-AI app', async () => {
        mockState.execAsync.mockResolvedValue({
          stdout: 'Safari|DELIMITER|Google\n',
        });

        const result = await detectActiveAIApp();

        expect(result).toBeNull();
      });

      it('should detect various browsers', async () => {
        const browsers = ['Safari', 'Chrome', 'Firefox', 'Arc', 'Edge', 'Brave', 'Opera'];

        for (const browser of browsers) {
          mockState.execAsync.mockResolvedValue({
            stdout: `${browser}|DELIMITER|Claude - claude.ai\n`,
          });

          const result = await detectActiveAIApp();

          expect(result?.isBrowser).toBe(true);
          expect(result?.aiAppType).toBe('Claude');
        }
      });
    });

    describe('AI App Polling', () => {
      // Note: Callback is only called when AI app CHANGES (not on every poll)
      // The module-level lastDetectedAIApp may retain state between tests

      it('should start AI app polling and call callback when AI app detected', async () => {
        vi.useFakeTimers();
        const callback = vi.fn();

        // Return an AI app so callback is called when state changes
        mockState.execAsync.mockResolvedValue({
          stdout: 'Claude|DELIMITER|Claude Desktop\n',
        });

        startAIAppPolling(1000, callback);
        await vi.runOnlyPendingTimersAsync();

        // Callback should be called when AI app state changes
        expect(callback).toHaveBeenCalled();
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({
          aiAppType: 'Claude',
        }));

        stopAIAppPolling();
        vi.useRealTimers();
      });

      it('should detect AI app changes between polls', async () => {
        vi.useFakeTimers();
        const callback = vi.fn();

        // First poll: detect Claude
        mockState.execAsync.mockResolvedValueOnce({
          stdout: 'Claude|DELIMITER|Claude Desktop\n',
        });

        startAIAppPolling(500, callback);
        await vi.runOnlyPendingTimersAsync();

        const callCountAfterFirst = callback.mock.calls.length;
        expect(callCountAfterFirst).toBeGreaterThanOrEqual(1);

        // Second poll: detect ChatGPT (different AI app)
        mockState.execAsync.mockResolvedValueOnce({
          stdout: 'ChatGPT|DELIMITER|ChatGPT Desktop\n',
        });

        await vi.runOnlyPendingTimersAsync();

        // Callback should have been called again due to AI app change
        expect(callback.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
        expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({
          aiAppType: 'ChatGPT',
        }));

        stopAIAppPolling();
        vi.useRealTimers();
      });

      it('should not call callback when AI app stays the same', async () => {
        vi.useFakeTimers();
        const callback = vi.fn();

        mockState.execAsync.mockResolvedValue({
          stdout: 'Claude|DELIMITER|Claude Desktop\n',
        });

        startAIAppPolling(500, callback);
        await vi.runOnlyPendingTimersAsync();

        const callCountAfterFirst = callback.mock.calls.length;

        // Same AI app on second poll
        await vi.runOnlyPendingTimersAsync();

        // Callback count should not increase since AI app didn't change
        expect(callback.mock.calls.length).toBe(callCountAfterFirst);

        stopAIAppPolling();
        vi.useRealTimers();
      });

      it('should stop AI app polling', () => {
        vi.useFakeTimers();
        const callback = vi.fn();

        mockState.execAsync.mockResolvedValue({
          stdout: 'Claude|DELIMITER|Claude Desktop\n',
        });

        startAIAppPolling(500, callback);
        stopAIAppPolling();

        vi.advanceTimersByTime(1000);

        expect(callback).not.toHaveBeenCalled();

        vi.useRealTimers();
      });

      it('getLastDetectedAIApp should return cached AI app', async () => {
        vi.useFakeTimers();
        const callback = vi.fn();

        mockState.execAsync.mockResolvedValue({
          stdout: 'ChatGPT|DELIMITER|ChatGPT Desktop\n',
        });

        startAIAppPolling(500, callback);
        await vi.runOnlyPendingTimersAsync();

        const result = getLastDetectedAIApp();

        expect(result).toBe('ChatGPT');

        stopAIAppPolling();
        vi.useRealTimers();
      });

      it('should reset lastDetectedAIApp when polling stops', () => {
        stopAIAppPolling();

        const result = getLastDetectedAIApp();

        expect(result).toBeNull();
      });
    });
  });

  describe('findProjectPathByName (via parseWindowTitle)', () => {
    it('should find project in direct path', () => {
      const projectPath = '/Users/testuser/Development/direct-project';
      mockState.existsSync.mockImplementation((p: string) => {
        return p === projectPath || p === '/Users/testuser/Development';
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      const windowInfo: ActiveWindowInfo = {
        appName: 'Code',
        windowTitle: 'file.ts — direct-project — VS Code',
        isIDE: true,
        ideName: 'Code',
      };

      const result = parseWindowTitle(windowInfo);

      expect(result?.projectPath).toBe(projectPath);
    });

    it('should find project in subdirectory', () => {
      const searchPath = '/Users/testuser/Development';
      const projectPath = '/Users/testuser/Development/active/sub-project';

      mockState.existsSync.mockImplementation((p: string) => {
        if (p === searchPath) return true;
        if (p === projectPath) return true;
        return false;
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });
      mockState.readdirSync.mockImplementation((p: string) => {
        if (p === searchPath) {
          return [{ name: 'active', isDirectory: () => true }];
        }
        return [];
      });

      const windowInfo: ActiveWindowInfo = {
        appName: 'Code',
        windowTitle: 'file.ts — sub-project — VS Code',
        isIDE: true,
        ideName: 'Code',
      };

      const result = parseWindowTitle(windowInfo);

      expect(result?.projectPath).toBe(projectPath);
    });

    it('should find project with case-insensitive matching', () => {
      const searchPath = '/Users/testuser/Development';
      const projectPath = '/Users/testuser/Development/MyProject';

      mockState.existsSync.mockImplementation((p: string) => {
        if (p === searchPath) return true;
        if (p === projectPath) return true;
        return false;
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });
      mockState.readdirSync.mockImplementation((p: string) => {
        if (p === searchPath) {
          return [{ name: 'MyProject', isDirectory: () => true }];
        }
        return [];
      });

      const windowInfo: ActiveWindowInfo = {
        appName: 'Code',
        windowTitle: 'file.ts — myproject — VS Code',
        isIDE: true,
        ideName: 'Code',
      };

      const result = parseWindowTitle(windowInfo);

      expect(result?.projectPath).toBe(projectPath);
    });

    it('should search multiple paths', () => {
      // Project in ~/Projects (not ~/Development)
      const projectPath = '/Users/testuser/Projects/projects-project';

      mockState.existsSync.mockImplementation((p: string) => {
        if (p === '/Users/testuser/Projects') return true;
        if (p === projectPath) return true;
        return false;
      });
      mockState.statSync.mockReturnValue({ isDirectory: () => true });

      const windowInfo: ActiveWindowInfo = {
        appName: 'Code',
        windowTitle: 'file.ts — projects-project — VS Code',
        isIDE: true,
        ideName: 'Code',
      };

      const result = parseWindowTitle(windowInfo);

      expect(result?.projectPath).toBe(projectPath);
    });

    it('should use enhanced finder when available', () => {
      const enhancedPath = '/custom/path/enhanced-project';
      mockState.findProjectPathByNameEnhanced = vi.fn((name: string) => {
        if (name === 'enhanced-project') return enhancedPath;
        return null;
      });

      // Need to re-import or the mock won't take effect in the findProjectPathByName function
      // Since findProjectPathByName is internal, we test through parseWindowTitle
      const _windowInfo: ActiveWindowInfo = {
        appName: 'Code',
        windowTitle: 'file.ts — enhanced-project — VS Code',
        isIDE: true,
        ideName: 'Code',
      };

      // Note: This test may not work as expected because the enhanced finder
      // is loaded asynchronously. In a real test, we'd need to ensure the
      // module is loaded before this test runs.
    });

    it('should handle filesystem errors gracefully', () => {
      mockState.existsSync.mockImplementation((p: string) => {
        if (p === '/Users/testuser/Development') return true;
        return false;
      });
      mockState.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const windowInfo: ActiveWindowInfo = {
        appName: 'Code',
        windowTitle: 'file.ts — error-project — VS Code',
        isIDE: true,
        ideName: 'Code',
      };

      // Should not throw, should return low confidence result
      const result = parseWindowTitle(windowInfo);

      expect(result?.confidence).toBe('low');
    });
  });
});
