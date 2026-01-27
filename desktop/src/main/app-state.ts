/**
 * App State Management
 * Centralized mutable singleton state for the main process.
 * Extracted from index.ts to break circular dependency with learning-engine.ts.
 */

import type { BrowserWindow } from 'electron';
import type { DetectedProject, ActiveWindowInfo } from './active-window-detector.js';

/**
 * Captured window context at hotkey time
 * Used to ensure correct project detection even if user switches windows
 */
export interface CapturedContext {
  windowInfo: ActiveWindowInfo | null;
  project: DetectedProject | null;
  timestamp: Date;
}

// ─── State Variables ────────────────────────────────────────────────────────

let _mainWindow: BrowserWindow | null = null;
let _isQuitting = false;
let _isRendererReady = false;
let _pendingText: { text: string; capturedContext: CapturedContext | null; isSourceAppBlocked: boolean } | null = null;
let _currentProject: DetectedProject | null = null;
let _lastFrontmostApp: string | null = null;
let _lastCapturedContext: CapturedContext | null = null;
let _lastAnalyzedText = '';
let _selectedProjectPath: string | null = null;

// ─── Getters ────────────────────────────────────────────────────────────────

export function getMainWindow(): BrowserWindow | null {
  return _mainWindow;
}

export function isQuitting(): boolean {
  return _isQuitting;
}

export function isRendererReady(): boolean {
  return _isRendererReady;
}

export function getPendingText(): typeof _pendingText {
  return _pendingText;
}

export function getCurrentProject(): DetectedProject | null {
  return _currentProject;
}

export function getLastFrontmostApp(): string | null {
  return _lastFrontmostApp;
}

export function getLastCapturedContext(): CapturedContext | null {
  return _lastCapturedContext;
}

export function getLastAnalyzedText(): string {
  return _lastAnalyzedText;
}

export function getSelectedProjectPath(): string | null {
  return _selectedProjectPath;
}

// ─── Setters ────────────────────────────────────────────────────────────────

export function setMainWindow(win: BrowserWindow | null): void {
  _mainWindow = win;
}

export function setIsQuitting(quitting: boolean): void {
  _isQuitting = quitting;
}

export function setIsRendererReady(ready: boolean): void {
  _isRendererReady = ready;
}

export function setPendingText(text: typeof _pendingText): void {
  _pendingText = text;
}

export function clearPendingText(): void {
  _pendingText = null;
}

export function setCurrentProject(project: DetectedProject | null): void {
  _currentProject = project;
}

export function setLastFrontmostApp(app: string | null): void {
  _lastFrontmostApp = app;
}

export function setLastCapturedContext(ctx: CapturedContext | null): void {
  _lastCapturedContext = ctx;
}

export function setLastAnalyzedText(text: string): void {
  _lastAnalyzedText = text;
}

export function setSelectedProjectPath(path: string | null): void {
  _selectedProjectPath = path;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if mainWindow is valid and not destroyed
 */
export function isMainWindowValid(): boolean {
  return _mainWindow !== null && !_mainWindow.isDestroyed();
}

/**
 * Reset state for new window session
 */
export function resetWindowState(): void {
  _isRendererReady = false;
  _pendingText = null;
  _lastFrontmostApp = null;
  _lastCapturedContext = null;
  _lastAnalyzedText = '';
}
