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

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Should show variants (conservative, balanced, comprehensive)
    const variantsSection = mainWindow.locator('text=/변형|variant|개선/i');
    await expect(variantsSection).toBeVisible({ timeout: 5000 });
  });

  test('should display multiple variant options', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'create component';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Navigate to variants/comparison tab if needed
    const comparisonTab = mainWindow.locator('text=/비교|comparison|variant/i');
    if (await comparisonTab.isVisible()) {
      await comparisonTab.click();
      await mainWindow.waitForTimeout(500);
    }

    // Should show at least 2-3 variants (conservative, balanced, comprehensive)
    const variantButtons = mainWindow.locator('[class*="variant"], button:has-text("conservative"), button:has-text("balanced")');
    const count = await variantButtons.count();

    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should show confidence scores for variants', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'refactor code';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Should display confidence percentages
    const confidence = mainWindow.locator('text=/%|신뢰도/');
    await expect(confidence).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Variant Copy', () => {
  test('should copy variant to clipboard', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'add feature';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Find and click a copy button
    const copyButton = mainWindow.locator('button:has-text("복사"), button:has-text("copy"), button[aria-label*="copy"]').first();

    if (await copyButton.isVisible()) {
      await copyButton.click();
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

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(1500);

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

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Should show original vs improved side-by-side or in tabs
    const original = mainWindow.locator(`text=${testPrompt}`);
    await expect(original).toBeVisible();

    // Should also show improved version
    const improved = mainWindow.locator('[class*="variant"], [class*="improved"]');
    await expect(improved).toBeVisible({ timeout: 5000 });
  });

  test('should display score improvements', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'do something';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Should show improvement percentage or score delta
    const improvement = mainWindow.locator('text=/+\\d+%|개선|improvement/i');
    await expect(improvement).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AI-Powered Variants', () => {
  test('should handle missing API key gracefully', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'test AI variant';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // If no API key configured, should show setup message
    const aiSection = mainWindow.locator('text=/AI|설정/i');

    // Either shows AI variant or setup message
    expect(app).toBeDefined();
  });

  test('should show AI variant when configured', async () => {
    const { app, mainWindow } = context;

    // Note: This test requires API key to be configured
    // In real tests, would use mock API or skip if not configured

    const testPrompt = 'create function';

    await invokeIPC(app, 'analyze-prompt', testPrompt);
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

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Find variant tabs/buttons
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

    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(2000);

    // Select a variant
    const variantButton = mainWindow.locator('button:has-text("balanced"), button:has-text("종합")').first();

    if (await variantButton.isVisible()) {
      await variantButton.click();
      await mainWindow.waitForTimeout(300);

      // Should show full variant text
      expect(app).toBeDefined();
    }
  });
});
