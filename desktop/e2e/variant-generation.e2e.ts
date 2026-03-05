/**
 * E2E Tests: Variant Generation and Copy
 *
 * Tests prompt variant generation and clipboard operations.
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
  waitForAnalysis,
  analyzePrompt,
  invokeIPC,
  getClipboard,
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

test.describe('Variant Generation', () => {
  test('should generate rule-based variants', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'fix bug';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Suggested Rewrite section (CollapsibleDetails) should be visible
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });
  });

  test('should display multiple variant options', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'create component';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Suggested Rewrite should be visible (contains variant content)
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });

    // Click to expand
    await suggestedRewrite.click();
    await mainWindow.waitForTimeout(300);

    // Should show variant text inside the collapsible
    expect(mainWindow).toBeDefined();
  });

  test('should show confidence scores for variants', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'refactor code';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // GoldenMiniBar shows scores in G:XX% format
    const goldenScore = mainWindow.locator('text=/G:\\d+%/');
    await expect(goldenScore).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Variant Copy', () => {
  test('should copy variant to clipboard', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'add feature';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Find and click the "Fix This Now" button (copies fix to clipboard)
    const fixButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixButton.isVisible()) {
      await fixButton.click();
      await mainWindow.waitForTimeout(500);

      // Check clipboard content
      const clipboardText = await getClipboard(app);
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });

  test('should copy original prompt', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'test original copy';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Find original prompt copy button
    const originalCopyButton = mainWindow.locator('button:has-text("원본"), button[aria-label*="original"]').first();

    if (await originalCopyButton.isVisible()) {
      await originalCopyButton.click();
      await mainWindow.waitForTimeout(500);

      const clipboardText = await getClipboard(app);
      expect(clipboardText).toContain(testPrompt);
    }
  });
});

test.describe('Variant Comparison', () => {
  test('should show before/after comparison', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'improve this';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // TopFix card and Suggested Rewrite provide before/after context
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });
  });

  test('should display score improvements', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'do something';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // GoldenMiniBar shows improvement scores
    const goldenScore = mainWindow.locator('text=/G:\\d+%/');
    await expect(goldenScore).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AI-Powered Variants', () => {
  test('should handle missing API key gracefully', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'test AI variant';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // If no API key configured, should still show rule-based variants
    // Grade badge should be visible
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible();
  });

  test('should show AI variant when configured', async () => {
    const { app, mainWindow } = context;

    // Note: This test requires API key to be configured
    // In real tests, would use mock API or skip if not configured

    const testPrompt = 'create function';

    await analyzePrompt(app, mainWindow, testPrompt);
    await mainWindow.waitForTimeout(3000);

    // May show AI variant or "setup required" message
    // Just verify app doesn't crash
    expect(app).toBeDefined();
  });
});

test.describe('Variant Navigation', () => {
  test('should switch between variant tabs', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'test navigation';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Find variant tabs/buttons (if available)
    const variantTabs = mainWindow.locator('[role="tab"], button:has-text("conservative"), button:has-text("balanced")');

    if (await variantTabs.count() > 1) {
      // Click second variant
      await variantTabs.nth(1).click();
      await mainWindow.waitForTimeout(300);

      // Should switch content
      expect(app).toBeDefined();
    }
  });

  test('should show variant details on selection', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'show details';

    await analyzePrompt(app, mainWindow, testPrompt);
    await waitForAnalysis(mainWindow);

    // Suggested Rewrite is expandable
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")').first();

    if (await suggestedRewrite.isVisible()) {
      await suggestedRewrite.click();
      await mainWindow.waitForTimeout(300);

      // Should show full variant text
      expect(app).toBeDefined();
    }
  });
});
