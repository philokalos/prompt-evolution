/**
 * App State Unit Tests
 * Tests centralized mutable singleton state for the main process.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

// Mock active-window-detector (types only, no runtime dependency)
vi.mock('../active-window-detector.js', () => ({}));

import {
  getMainWindow,
  setMainWindow,
  isQuitting,
  setIsQuitting,
  isRendererReady,
  setIsRendererReady,
  getPendingText,
  setPendingText,
  clearPendingText,
  getCurrentProject,
  setCurrentProject,
  getLastFrontmostApp,
  setLastFrontmostApp,
  getLastCapturedContext,
  setLastCapturedContext,
  getLastAnalyzedText,
  setLastAnalyzedText,
  getSelectedProjectPath,
  setSelectedProjectPath,
  isMainWindowValid,
  resetWindowState,
  type CapturedContext,
} from '../app-state.js';

describe('App State', () => {
  beforeEach(() => {
    // Reset all state
    setMainWindow(null);
    setIsQuitting(false);
    setIsRendererReady(false);
    clearPendingText();
    setCurrentProject(null);
    setLastFrontmostApp(null);
    setLastCapturedContext(null);
    setLastAnalyzedText('');
    setSelectedProjectPath(null);
  });

  describe('initial state', () => {
    it('should return null/false defaults', () => {
      expect(getMainWindow()).toBeNull();
      expect(isQuitting()).toBe(false);
      expect(isRendererReady()).toBe(false);
      expect(getPendingText()).toBeNull();
      expect(getCurrentProject()).toBeNull();
      expect(getLastFrontmostApp()).toBeNull();
      expect(getLastCapturedContext()).toBeNull();
      expect(getLastAnalyzedText()).toBe('');
      expect(getSelectedProjectPath()).toBeNull();
    });
  });

  describe('window management', () => {
    it('should set and get MainWindow', () => {
      const mockWindow = {
        isDestroyed: () => false,
      } as unknown as import('electron').BrowserWindow;

      setMainWindow(mockWindow);
      expect(getMainWindow()).toBe(mockWindow);
    });

    it('should report valid window', () => {
      const mockWindow = {
        isDestroyed: () => false,
      } as unknown as import('electron').BrowserWindow;

      setMainWindow(mockWindow);
      expect(isMainWindowValid()).toBe(true);
    });

    it('should report invalid when null', () => {
      expect(isMainWindowValid()).toBe(false);
    });

    it('should report invalid when destroyed', () => {
      const mockWindow = {
        isDestroyed: () => true,
      } as unknown as import('electron').BrowserWindow;

      setMainWindow(mockWindow);
      expect(isMainWindowValid()).toBe(false);
    });
  });

  describe('quitting flag', () => {
    it('should set and get IsQuitting', () => {
      setIsQuitting(true);
      expect(isQuitting()).toBe(true);

      setIsQuitting(false);
      expect(isQuitting()).toBe(false);
    });
  });

  describe('renderer ready', () => {
    it('should set and get IsRendererReady', () => {
      setIsRendererReady(true);
      expect(isRendererReady()).toBe(true);
    });
  });

  describe('pending text', () => {
    it('should set and get PendingText', () => {
      const pending = {
        text: 'hello',
        capturedContext: null,
        isSourceAppBlocked: false,
      };
      setPendingText(pending);
      expect(getPendingText()).toBe(pending);
    });

    it('should clear PendingText', () => {
      setPendingText({ text: 'test', capturedContext: null, isSourceAppBlocked: false });
      clearPendingText();
      expect(getPendingText()).toBeNull();
    });
  });

  describe('project tracking', () => {
    it('should set and get CurrentProject', () => {
      const project = {
        projectName: 'test-project',
        projectPath: '/path/to/project',
        confidence: 0.9,
        source: 'vscode' as const,
      };
      setCurrentProject(project);
      expect(getCurrentProject()).toBe(project);
    });

    it('should set and get SelectedProjectPath', () => {
      setSelectedProjectPath('/selected/path');
      expect(getSelectedProjectPath()).toBe('/selected/path');
    });
  });

  describe('analysis tracking', () => {
    it('should set and get LastAnalyzedText', () => {
      setLastAnalyzedText('some prompt text');
      expect(getLastAnalyzedText()).toBe('some prompt text');
    });

    it('should set and get LastCapturedContext', () => {
      const ctx: CapturedContext = {
        windowInfo: null,
        project: null,
        timestamp: new Date(),
      };
      setLastCapturedContext(ctx);
      expect(getLastCapturedContext()).toBe(ctx);
    });

    it('should set and get LastFrontmostApp', () => {
      setLastFrontmostApp('Safari');
      expect(getLastFrontmostApp()).toBe('Safari');
    });
  });

  describe('resetWindowState', () => {
    it('should reset window-related state', () => {
      setIsRendererReady(true);
      setPendingText({ text: 'test', capturedContext: null, isSourceAppBlocked: false });
      setLastFrontmostApp('Chrome');
      setLastCapturedContext({ windowInfo: null, project: null, timestamp: new Date() });
      setLastAnalyzedText('some text');

      resetWindowState();

      expect(isRendererReady()).toBe(false);
      expect(getPendingText()).toBeNull();
      expect(getLastFrontmostApp()).toBeNull();
      expect(getLastCapturedContext()).toBeNull();
      expect(getLastAnalyzedText()).toBe('');
    });
  });
});
