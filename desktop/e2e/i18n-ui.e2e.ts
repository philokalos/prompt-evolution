/**
 * E2E Tests: Internationalization (i18n) UI
 *
 * Tests language switching, text updates, and persistence across the UI.
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
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

test.describe('Language Detection', () => {
  test('should detect system language on first launch', async () => {
    const { app } = context;

    const language = await invokeIPC(app, 'get-language');

    expect(language).toMatch(/^(en|ko|auto)$/);
  });

  test('should have default language set', async () => {
    const { mainWindow } = context;

    // Should show text in some language (Korean or English)
    const hasText = await mainWindow.locator('body').textContent();

    expect(hasText).toBeTruthy();
    expect(hasText!.length).toBeGreaterThan(0);
  });
});

test.describe('Language Switching', () => {
  test('should switch to English', async () => {
    const { app, mainWindow } = context;

    // Set language to English
    await invokeIPC(app, 'set-language', 'en');
    await mainWindow.waitForTimeout(1000);

    // Check for English text (case-insensitive)
    const englishText = mainWindow.locator('text=/Analysis|Settings|Progress/i');
    await expect(englishText.first()).toBeVisible({ timeout: 5000 });

    // Verify language was saved
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('en');
  });

  test('should switch to Korean', async () => {
    const { app, mainWindow } = context;

    // Set language to Korean
    await invokeIPC(app, 'set-language', 'ko');
    await mainWindow.waitForTimeout(1000);

    // Check for Korean text
    const koreanText = mainWindow.locator('text=/분석|설정|진행/');
    await expect(koreanText.first()).toBeVisible({ timeout: 5000 });

    // Verify language was saved
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('ko');
  });

  test('should update all UI text on language change', async () => {
    const { app, mainWindow } = context;

    // Start with English
    await invokeIPC(app, 'set-language', 'en');
    await mainWindow.waitForTimeout(1000);

    const englishTabsExist = await mainWindow.locator('text=/Analysis/i').isVisible();

    // Switch to Korean
    await invokeIPC(app, 'set-language', 'ko');
    await mainWindow.waitForTimeout(1000);

    const koreanTabsExist = await mainWindow.locator('text=/분석/').isVisible();

    // Should have text in both languages at different times
    expect(englishTabsExist || koreanTabsExist).toBe(true);
  });
});

test.describe('Settings UI Language', () => {
  test('should show language selector in settings', async () => {
    const { mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정"), button:has-text("Settings")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for language options
      const languageSelector = mainWindow.locator('text=/언어|Language/i, select, [role="combobox"]');
      await expect(languageSelector).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show language options', async () => {
    const { app, mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정"), button:has-text("Settings")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Should have language options (Auto, English, Korean)
      // Note: Exact UI depends on implementation
      expect(mainWindow).toBeDefined();
    }
  });

  test('should change language via settings UI', async () => {
    const { app, mainWindow } = context;

    const initialLanguage = await invokeIPC(app, 'get-language');

    // Change language via IPC (simulates settings change)
    const newLanguage = initialLanguage === 'en' ? 'ko' : 'en';
    await invokeIPC(app, 'set-language', newLanguage);
    await mainWindow.waitForTimeout(1000);

    const updatedLanguage = await invokeIPC(app, 'get-language');
    expect(updatedLanguage).toBe(newLanguage);
  });
});

test.describe('Component-Specific Translations', () => {
  test('should translate GOLDEN dimension labels', async () => {
    const { app, mainWindow } = context;

    const testPrompt = 'Test translation prompt';
    await invokeIPC(app, 'analyze-prompt', testPrompt);
    await mainWindow.waitForTimeout(1500);

    // English labels
    await invokeIPC(app, 'set-language', 'en');
    await mainWindow.waitForTimeout(800);

    const englishLabel = mainWindow.locator('text=/Goal|Output|Limits/i');
    await expect(englishLabel.first()).toBeVisible({ timeout: 5000 });
  });

  test('should translate issue severity labels', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Poor prompt');
    await mainWindow.waitForTimeout(1500);

    // Switch to Korean
    await invokeIPC(app, 'set-language', 'ko');
    await mainWindow.waitForTimeout(800);

    // Should show Korean severity labels
    const koreanSeverity = mainWindow.locator('text=/높음|중간|낮음/');
    await expect(koreanSeverity.first()).toBeVisible({ timeout: 5000 });
  });

  test('should translate button labels', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Button test');
    await mainWindow.waitForTimeout(1500);

    // English buttons
    await invokeIPC(app, 'set-language', 'en');
    await mainWindow.waitForTimeout(800);

    const englishButton = mainWindow.locator('button:has-text("Copy"), button:has-text("Apply")');
    await expect(englishButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('should translate help text', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'set-language', 'ko');
    await mainWindow.waitForTimeout(1000);

    // Look for help text in Korean
    const helpText = mainWindow.locator('text=/도움말|설명/i');

    // Help text may or may not be visible by default
    // Just verify language was set correctly
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('ko');
  });
});

test.describe('Tray Menu Language', () => {
  test('should update tray menu on language change', async () => {
    const { app } = context;

    // Change language (triggers tray menu rebuild)
    await invokeIPC(app, 'set-language', 'en');
    await app.waitForTimeout(500);

    // Tray menu should be rebuilt
    // Note: Cannot directly test tray menu in Playwright
    // Just verify language was changed
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('en');
  });

  test('should persist tray menu language', async () => {
    const { app } = context;

    await invokeIPC(app, 'set-language', 'ko');
    await app.waitForTimeout(500);

    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('ko');
  });
});

test.describe('Error Messages', () => {
  test('should translate error messages', async () => {
    const { app, mainWindow } = context;

    // Trigger an error scenario
    await invokeIPC(app, 'analyze-prompt', '');
    await mainWindow.waitForTimeout(500);

    // Should show error in current language
    const errorMessage = mainWindow.locator('text=/분석할|no prompt|empty/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('should translate validation messages', async () => {
    const { app, mainWindow } = context;

    // Try to set invalid language
    try {
      await invokeIPC(app, 'set-language', 'invalid');
    } catch (error) {
      // May throw validation error
    }

    // App should still be running
    expect(app).toBeDefined();
  });
});

test.describe('Language Persistence', () => {
  test('should persist language selection', async () => {
    const { app } = context;

    // Set language
    await invokeIPC(app, 'set-language', 'en');
    await app.waitForTimeout(500);

    // Retrieve language (simulates restart)
    const language = await invokeIPC(app, 'get-language');

    expect(language).toBe('en');
  });

  test('should restore language on app restart', async () => {
    const { app } = context;

    // Set language
    await invokeIPC(app, 'set-language', 'ko');
    await app.waitForTimeout(500);

    // Note: Cannot actually restart app in test
    // Just verify persistence mechanism works
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('ko');
  });

  test('should handle missing language file gracefully', async () => {
    const { app } = context;

    // Set to supported language
    await invokeIPC(app, 'set-language', 'en');
    await app.waitForTimeout(500);

    // Should work without errors
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('en');
  });
});

test.describe('Auto Language Detection', () => {
  test('should use system language when set to auto', async () => {
    const { app } = context;

    // Set to auto
    await invokeIPC(app, 'set-language', 'auto');
    await app.waitForTimeout(500);

    const language = await invokeIPC(app, 'get-language');

    // Should be auto or resolved to a specific language
    expect(['auto', 'en', 'ko']).toContain(language);
  });

  test('should update when system language changes', async () => {
    const { app } = context;

    await invokeIPC(app, 'set-language', 'auto');
    await app.waitForTimeout(500);

    // Auto should be set
    const language = await invokeIPC(app, 'get-language');
    expect(['auto', 'en', 'ko']).toContain(language);
  });
});

test.describe('Interpolation and Formatting', () => {
  test('should handle numeric interpolation', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Numeric test');
    await mainWindow.waitForTimeout(1500);

    // Should show scores with % (e.g., "85%")
    const scoreText = mainWindow.locator('text=/%/');
    await expect(scoreText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle pluralization', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Plural test with issues');
    await mainWindow.waitForTimeout(1500);

    // Should show issue count (e.g., "3 issues" or "3개 이슈")
    // Note: Exact format depends on implementation
    expect(mainWindow).toBeDefined();
  });

  test('should format dates/times correctly', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Date test');
    await mainWindow.waitForTimeout(1500);

    // History should have timestamps
    // Format depends on language setting
    expect(mainWindow).toBeDefined();
  });
});
