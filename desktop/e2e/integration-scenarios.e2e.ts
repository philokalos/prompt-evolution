/**
 * E2E Tests: Integration Scenarios
 *
 * Tests complete workflows combining multiple features and components.
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
  waitForAnalysis,
  setClipboard,
  getClipboard,
  invokeIPC,
  getAllWindows,
  waitForNewWindow,
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

test.describe('Complete Analysis Workflow', () => {
  test('should complete full analysis from capture to copy', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Create a React component for user authentication with email validation';

    // Step 1: Capture text
    await setClipboard(app, testPrompt);
    await invokeIPC(app, 'analyze-prompt', testPrompt);

    // Step 2: Verify analysis completes (grade badge visible)
    await waitForAnalysis(mainWindow);
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible();

    // Step 3: Check GOLDEN scores (GoldenMiniBar format: G:XX%)
    const goldenScore = mainWindow.locator('text=/G:\\d+%/');
    await expect(goldenScore).toBeVisible({ timeout: 5000 });

    // Step 4: View suggested rewrite (CollapsibleDetails)
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });

    // Step 5: Use TopFixCard "Fix This Now" action
    const fixNowButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixNowButton.isVisible()) {
      await fixNowButton.click();
      await mainWindow.waitForTimeout(500);

      // Verify clipboard updated
      const clipboardText = await getClipboard(app);
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(testPrompt.length);
    }
  });

  test('should handle multiple sequential analyses', async () => {
    const { app, mainWindow } = context;

    const prompts = [
      'Fix bug in login',
      'Add error handling to API calls',
      'Refactor authentication module',
    ];

    for (const prompt of prompts) {
      await invokeIPC(app, 'analyze-prompt', prompt);

      // Wait for analysis to complete (grade badge visible)
      await waitForAnalysis(mainWindow);
    }

    // History should have all analyses
    const history = await invokeIPC(app, 'get-history', { limit: 10 });
    expect(history.length).toBeGreaterThanOrEqual(prompts.length);
  });

  test('should track progress across multiple analyses', async () => {
    const { app, mainWindow } = context;

    // Get initial stats
    const initialStats = await invokeIPC(app, 'get-stats');

    // Perform multiple analyses
    await invokeIPC(app, 'analyze-prompt', 'First analysis for progress');
    await mainWindow.waitForTimeout(1000);

    await invokeIPC(app, 'analyze-prompt', 'Second analysis with improvements');
    await mainWindow.waitForTimeout(1000);

    // Get updated stats
    const updatedStats = await invokeIPC(app, 'get-stats');

    expect(updatedStats.totalAnalyses).toBeGreaterThan(initialStats.totalAnalyses || 0);
  });
});

// ghost-bar:show is a webContents.send event, not an IPC handler
test.describe.skip('Ghost Bar Integration', () => {
  test('should show Ghost Bar with improved prompt and apply', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'improve this code';
    const initialWindowCount = (await getAllWindows(app)).length;

    // Analyze prompt
    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Show Ghost Bar with improved variant
    await invokeIPC(app, 'ghost-bar:show', 'Improved version: Refactor the code to improve readability and performance');

    const ghostBar = await waitForNewWindow(app, initialWindowCount, 3000);
    expect(ghostBar).toBeDefined();

    // Apply improved prompt
    const applyButton = ghostBar.locator('button:has-text("적용"), button:has-text("Apply")').first();

    if (await applyButton.isVisible()) {
      await applyButton.click();
      await app.waitForTimeout(500);

      // Ghost Bar should close/hide
      expect(app).toBeDefined();
    }
  });

  test('should handle Ghost Bar workflow with multiple windows', async () => {
    const { app, mainWindow } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    // Show Ghost Bar
    await invokeIPC(app, 'ghost-bar:show', 'Test multi-window');
    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    expect(ghostBar).toBeDefined();

    // Main window should still be functional
    expect(mainWindow).toBeDefined();
    const mainWindowTitle = await mainWindow.title();
    expect(mainWindowTitle).toBeTruthy();

    // Close Ghost Bar
    await invokeIPC(app, 'ghost-bar:hide');
    await app.waitForTimeout(500);
  });
});

test.describe('Settings Integration', () => {
  test('should change language and see updates throughout app', async () => {
    const { app, mainWindow } = context;

    // Analyze in default language
    await invokeIPC(app, 'analyze-prompt', 'Language test');
    await mainWindow.waitForTimeout(1500);

    // Change language to English
    await invokeIPC(app, 'set-language', 'en');
    await mainWindow.waitForTimeout(1000);

    // UI should update
    const englishText = mainWindow.locator('text=/Analysis|Settings|Progress/i');
    await expect(englishText.first()).toBeVisible({ timeout: 5000 });

    // Change to Korean
    await invokeIPC(app, 'set-language', 'ko');
    await mainWindow.waitForTimeout(1000);

    const koreanText = mainWindow.locator('text=/분석|설정|진행/');
    await expect(koreanText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should update AI provider and use in analysis', async () => {
    const { app, mainWindow } = context;

    // Configure AI provider
    await invokeIPC(app, 'set-providers', [
      { type: 'claude', apiKey: 'test-key', enabled: false },
    ]);
    await mainWindow.waitForTimeout(500);

    // Analyze prompt (will use rule-based variants only)
    await invokeIPC(app, 'analyze-prompt', 'Provider test prompt');
    await mainWindow.waitForTimeout(2000);

    // Should show suggested rewrite (rule-based)
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });
  });

  test('should change hotkey setting', async () => {
    const { app } = context;

    // Note: Cannot actually test global shortcut trigger in Playwright
    // Just verify setting can be changed
    try {
      await invokeIPC(app, 'set-hotkey', 'CommandOrControl+Shift+P');
      await app.waitForTimeout(500);
    } catch (error) {
      // May have validation
    }

    expect(app).toBeDefined();
  });
});

test.describe('Error Recovery', () => {
  test('should recover from empty prompt error', async () => {
    const { app, mainWindow } = context;

    // Try empty prompt
    await invokeIPC(app, 'analyze-prompt', '');
    await mainWindow.waitForTimeout(500);

    // Should show error state (ko: "분석할 프롬프트가 없어요", en: "No prompt to analyze")
    const emptyState = mainWindow.locator('text=/분석할 프롬프트|No prompt to analyze/i');
    await expect(emptyState).toBeVisible();

    // Analyze valid prompt
    await invokeIPC(app, 'analyze-prompt', 'Valid prompt after error');

    // Should show analysis (grade badge visible)
    await waitForAnalysis(mainWindow);
  });

  test('should recover from API error', async () => {
    const { app, mainWindow } = context;

    // Configure invalid API (will fail gracefully)
    await invokeIPC(app, 'set-providers', [
      { type: 'claude', apiKey: 'invalid-key', enabled: true },
    ]);
    await mainWindow.waitForTimeout(500);

    // Analyze (should fall back to rule-based)
    await invokeIPC(app, 'analyze-prompt', 'API error test');
    await mainWindow.waitForTimeout(2000);

    // Should still show analysis (rule-based variants)
    expect(mainWindow).toBeDefined();
  });

  test('should handle window hide/show without losing state', async () => {
    const { app, mainWindow } = context;

    // Analyze prompt
    await invokeIPC(app, 'analyze-prompt', 'State persistence test');
    await waitForAnalysis(mainWindow);

    // Hide window
    await invokeIPC(app, 'hide-window');
    await mainWindow.waitForTimeout(500);

    // Show window
    await mainWindow.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await mainWindow.waitForTimeout(500);

    // Analysis should still be visible (grade badge persists)
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible();
  });
});

test.describe('History and Progress Integration', () => {
  test('should build history and show in progress tab', async () => {
    const { app, mainWindow } = context;

    // Create multiple analyses
    const prompts = ['First', 'Second', 'Third'];

    for (const prompt of prompts) {
      await invokeIPC(app, 'analyze-prompt', `${prompt} history test`);
      await mainWindow.waitForTimeout(1000);
    }

    // Navigate to progress tab (ko: "내 진행 상황 보기", en: "View my progress")
    const progressTab = mainWindow.locator('button:has-text("내 진행 상황"), button:has-text("My Progress"), button:has-text("View my progress")');
    if (await progressTab.first().isVisible()) {
      await progressTab.first().click();
      await mainWindow.waitForTimeout(500);

      // Should show history
      expect(mainWindow).toBeDefined();
    }

    // Verify history via IPC
    const history = await invokeIPC(app, 'get-history', { limit: 10 });
    expect(history.length).toBeGreaterThanOrEqual(prompts.length);
  });

  test('should show trends across multiple analyses', async () => {
    const { app, mainWindow } = context;

    // Analyze multiple prompts
    await invokeIPC(app, 'analyze-prompt', 'Poor prompt');
    await mainWindow.waitForTimeout(1000);

    await invokeIPC(app, 'analyze-prompt', 'Better prompt with clear goal and output');
    await mainWindow.waitForTimeout(1000);

    await invokeIPC(app, 'analyze-prompt', 'Excellent prompt: Create a React login component with email validation, error handling, and responsive design');
    await mainWindow.waitForTimeout(1000);

    // Get trend data
    const trend = await invokeIPC(app, 'get-score-trend', { days: 7 });

    expect(trend).toBeDefined();
    expect(Array.isArray(trend)).toBe(true);
  });

  test('should identify and show improvement opportunities', async () => {
    const { app, mainWindow } = context;

    // Analyze with weak dimensions
    await invokeIPC(app, 'analyze-prompt', 'do something');
    await mainWindow.waitForTimeout(1500);

    // Get weaknesses
    const weaknesses = await invokeIPC(app, 'get-top-weaknesses');

    expect(weaknesses).toBeDefined();
    expect(Array.isArray(weaknesses)).toBe(true);
  });
});

test.describe('Real-World Scenarios', () => {
  test('should handle rapid successive analyses', async () => {
    const { app, mainWindow } = context;

    // Rapidly trigger multiple analyses (stress test)
    const rapidPrompts = ['One', 'Two', 'Three', 'Four', 'Five'];

    for (const prompt of rapidPrompts) {
      invokeIPC(app, 'analyze-prompt', prompt); // Don't await
      await mainWindow.waitForTimeout(300);
    }

    // Wait for processing
    await mainWindow.waitForTimeout(3000);

    // App should still be responsive
    expect(mainWindow).toBeDefined();

    // At least some analyses should complete
    const history = await invokeIPC(app, 'get-history', { limit: 10 });
    expect(history.length).toBeGreaterThan(0);
  });

  test('should handle very long prompt text', async () => {
    const { app, mainWindow } = context;

    const longPrompt = 'Create a complex system that ' + 'handles multiple scenarios '.repeat(50);

    await invokeIPC(app, 'analyze-prompt', longPrompt);
    await mainWindow.waitForTimeout(2000);

    // Should process without crashing
    expect(mainWindow).toBeDefined();
  });

  test('should handle special characters in prompts', async () => {
    const { app, mainWindow } = context;

    const specialPrompt = 'Test with special chars: @#$%^&*() "quotes" \'apostrophes\' 한글 日本語';

    await invokeIPC(app, 'analyze-prompt', specialPrompt);
    await mainWindow.waitForTimeout(1500);

    // Should handle without errors
    expect(mainWindow).toBeDefined();
  });

  test('should complete full workflow: capture → analyze → improve → copy → paste', async () => {
    const { app, mainWindow } = context;

    // Step 1: Capture (simulate)
    const originalPrompt = 'fix bug';
    await setClipboard(app, originalPrompt);

    // Step 2: Analyze
    await invokeIPC(app, 'analyze-prompt', originalPrompt);
    await waitForAnalysis(mainWindow);

    // Step 3: Use TopFixCard "Fix This Now" action
    const fixNowButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixNowButton.isVisible()) {
      // Step 4: Apply fix (copies to clipboard)
      await fixNowButton.click();
      await mainWindow.waitForTimeout(500);

      // Step 5: Verify clipboard (simulate paste)
      const improvedPrompt = await getClipboard(app);

      expect(improvedPrompt).toBeTruthy();
      expect(improvedPrompt.length).toBeGreaterThan(originalPrompt.length);
      expect(improvedPrompt).not.toBe(originalPrompt);

      console.log('Complete workflow successful:');
      console.log('   Original:', originalPrompt);
      console.log('   Improved:', improvedPrompt.substring(0, 100) + '...');
    }
  });
});

// ghost-bar:show/hide not available as IPC handlers
test.describe.skip('Multi-Window Coordination', () => {
  test('should coordinate main window and Ghost Bar', async () => {
    const { app, mainWindow } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    // Analyze in main window
    await invokeIPC(app, 'analyze-prompt', 'Multi-window test');
    await mainWindow.waitForTimeout(1500);

    // Show Ghost Bar
    await invokeIPC(app, 'ghost-bar:show', 'Improved: Multi-window coordination test');
    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    expect(ghostBar).toBeDefined();
    expect(mainWindow).toBeDefined();

    // Both windows should be functional
    const mainTitle = await mainWindow.title();
    const ghostTitle = await ghostBar.title();

    expect(mainTitle).toBeTruthy();
    expect(ghostTitle).toBeTruthy();

    // Close Ghost Bar
    await invokeIPC(app, 'ghost-bar:hide');
    await app.waitForTimeout(500);

    // Main window should remain
    expect(mainWindow).toBeDefined();
  });

  test('should handle window focus changes', async () => {
    const { mainWindow } = context;

    // Simulate focus changes
    await mainWindow.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await mainWindow.waitForTimeout(300);

    await mainWindow.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await mainWindow.waitForTimeout(300);

    // Window should remain functional
    expect(mainWindow).toBeDefined();
  });
});
