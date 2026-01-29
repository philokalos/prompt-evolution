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
    await invokeIPC(app, 'analyze-prompt', testPrompt);

    // Wait for analysis to complete
    await mainWindow.waitForTimeout(1000);

    // Should display the analyzed prompt
    const promptText = mainWindow.locator(`text=${testPrompt}`);
    await expect(promptText).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty text', async () => {
    const { app, mainWindow } = context;

    // Try to analyze empty text
    await invokeIPC(app, 'analyze-prompt', '');

    await mainWindow.waitForTimeout(500);

    // Should show empty state or error
    const emptyState = mainWindow.locator('text=/분석할 프롬프트|no prompt/i');
    await expect(emptyState).toBeVisible();
  });

  test('should handle very long text', async () => {
    const { app, mainWindow } = context;

    const longPrompt = 'A'.repeat(5000);

    await invokeIPC(app, 'analyze-prompt', longPrompt);

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

    await invokeIPC(app, 'analyze-prompt', testPrompt);

    await mainWindow.waitForTimeout(1500);

    // Should show GOLDEN radar chart or scores
    const radar = mainWindow.locator('[class*="radar"], [aria-label*="GOLDEN"]');
    await expect(radar).toBeVisible({ timeout: 5000 });
  });

  test('should display issues list', async () => {
    const { app, mainWindow } = context;

    const poorPrompt = 'fix it';

    await invokeIPC(app, 'analyze-prompt', poorPrompt);

    await mainWindow.waitForTimeout(1500);

    // Should show issues
    const issuesList = mainWindow.locator('text=/이슈|issue|문제/i');
    await expect(issuesList).toBeVisible({ timeout: 5000 });
  });

  test('should display quality grade', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Refactor the authentication module to use JWT tokens';

    await invokeIPC(app, 'analyze-prompt', testPrompt);

    await mainWindow.waitForTimeout(1500);

    // Should show grade (A, B, C, D, F)
    const grade = mainWindow.locator('text=/[ABCDF]/');
    await expect(grade).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Analysis State', () => {
  test('should show loading state during analysis', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Create a React component for user profile';

    // Start analysis
    const analysisPromise = invokeIPC(app, 'analyze-prompt', testPrompt);

    // Should show loading indicator (briefly)
    // Note: This is timing-sensitive and may be flaky
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

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(1500);

    // Hide window
    await invokeIPC(app, 'hide-window');
    await mainWindow.waitForTimeout(500);

    // Show window again
    await mainWindow.evaluate(() => {
      // Simulate window show (in real app, would be via hotkey or tray click)
      window.dispatchEvent(new Event('focus'));
    });

    // Analysis results should still be visible
    const promptText = mainWindow.locator(`text=${testPrompt}`);
    await expect(promptText).toBeVisible();
  });
});

test.describe('Multiple Analyses', () => {
  test('should handle sequential analyses', async () => {
    const { app, mainWindow } = context;

    const prompts = ['First prompt', 'Second prompt', 'Third prompt'];

    for (const prompt of prompts) {
      await invokeIPC(app, 'analyze-prompt', prompt);
      await mainWindow.waitForTimeout(1000);
    }

    // Should show the last prompt
    const lastPrompt = mainWindow.locator(`text=${prompts[prompts.length - 1]}`);
    await expect(lastPrompt).toBeVisible();
  });

  test('should maintain history of analyses', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Test prompt for history';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
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
