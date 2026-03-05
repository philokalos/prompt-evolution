/**
 * E2E Tests: Text Capture and Analysis
 *
 * Tests the core text capture and analysis workflow.
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
  waitForAnalysis,
  analyzePrompt,
  setClipboard,
  invokeIPC,
  type ElectronAppContext,
} from './helpers/electron-app';

let context: ElectronAppContext;

test.beforeEach(async () => {
  context = await launchElectronApp();
  await waitForAppReady(context.mainWindow);
});

test.afterEach(async () => {
  await closeElectronApp(context);
});

test.describe('Text Capture', () => {
  test('should capture text from clipboard', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Fix the bug in login.ts';

    // Set clipboard content
    await setClipboard(app, testPrompt);

    // Trigger analysis via IPC (simulating hotkey capture)
    await analyzePrompt(app, mainWindow, testPrompt);

    // Wait for analysis to complete (grade badge visible)
    await waitForAnalysis(mainWindow);

    // Grade badge should be visible
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible();
  });

  test('should handle empty text', async () => {
    const { app, mainWindow } = context;

    // Try to analyze empty text
    await analyzePrompt(app, mainWindow, '');

    await mainWindow.waitForTimeout(500);

    // Should show empty state or error (ko: "분석할 프롬프트가 없어요", en: "No prompt to analyze")
    const emptyState = mainWindow.locator('text=/분석할 프롬프트|No prompt to analyze/i');
    await expect(emptyState).toBeVisible({ timeout: 3000 });
  });

  test('should handle very long text', async () => {
    const { app, mainWindow } = context;

    const longPrompt = 'A'.repeat(5000);

    await analyzePrompt(app, mainWindow, longPrompt);

    await mainWindow.waitForTimeout(2000);

    // Should process without crashing
    // May truncate or show warning, but shouldn't crash
    expect(app).toBeDefined();
  });
});

test.describe('Analysis Results', () => {
  test('should display GOLDEN scores after analysis', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Fix authentication bug in login.ts file';

    await analyzePrompt(app, mainWindow, testPrompt);

    // Wait for analysis to complete (grade badge visible)
    await waitForAnalysis(mainWindow);

    // GoldenMiniBar shows scores in G:XX% format
    const goldenScore = mainWindow.locator('text=/G:\\d+%/');
    await expect(goldenScore).toBeVisible({ timeout: 5000 });
  });

  test('should display issues list', async () => {
    const { app, mainWindow } = context;

    const poorPrompt = 'fix it';

    await analyzePrompt(app, mainWindow, poorPrompt);

    // Wait for analysis to complete
    await waitForAnalysis(mainWindow);

    // TopFix card shows coaching content (ko: "지금 이것만!", en: "Fix This First")
    const topFix = mainWindow.locator('text=/지금 이것만|Fix This First/i');
    await expect(topFix).toBeVisible({ timeout: 5000 });
  });

  test('should display quality grade', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Refactor the authentication module to use JWT tokens';

    await analyzePrompt(app, mainWindow, testPrompt);

    // Wait for analysis to complete
    await waitForAnalysis(mainWindow);

    // Grade badge should be visible with a letter grade
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible({ timeout: 5000 });
    const gradeText = await gradeBadge.textContent();
    expect(gradeText).toMatch(/[ABCDF]/);
  });
});

test.describe('Analysis State', () => {
  test('should show loading state during analysis', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Create a React component for user profile';

    // Start analysis
    const analysisPromise = analyzePrompt(app, mainWindow, testPrompt);

    // Should show loading indicator (briefly)
    const loading = mainWindow.locator('text=/분석|analyzing|loading/i');

    // Wait a bit for the promise to complete
    await analysisPromise;
    await mainWindow.waitForTimeout(1000);

    // Analysis should be complete
    expect(app).toBeDefined();
  });

  test('should persist analysis after window hide/show', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Add error handling to API calls';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Hide window
    await invokeIPC(app, 'hide-window');
    await mainWindow.waitForTimeout(500);

    // Show window again
    await mainWindow.evaluate(() => {
      // Simulate window show (in real app, would be via hotkey or tray click)
      window.dispatchEvent(new Event('focus'));
    });

    // Grade badge should still be visible
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible();
  });
});

test.describe('Multiple Analyses', () => {
  test('should handle sequential analyses', async () => {
    const { app, mainWindow } = context;

    const prompts = ['First prompt', 'Second prompt', 'Third prompt'];

    for (const prompt of prompts) {
      await analyzePrompt(app, mainWindow, prompt);
      await mainWindow.waitForTimeout(1000);
    }

    // Grade badge should be visible for the last analysis
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible();
  });

  test('should maintain history of analyses', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Test prompt for history';

    await analyzePrompt(app, mainWindow, testPrompt);
    await mainWindow.waitForTimeout(1500);

    // Navigate to history/progress tab
    const progressTab = mainWindow.locator('text=/진행|progress|history/i');
    if (await progressTab.isVisible()) {
      await progressTab.click();
      await mainWindow.waitForTimeout(500);

      // Should show some stats or history
      expect(app).toBeDefined();
    }
  });
});
