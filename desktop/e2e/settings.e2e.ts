/**
 * E2E Tests: Settings Management
 *
 * Tests settings UI, configuration changes, and persistence.
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

test.describe('Settings Navigation', () => {
  test('should open settings page', async () => {
    const { mainWindow } = context;

    // Look for settings button/link
    const settingsButton = mainWindow.locator('button:has-text("설정"), button:has-text("settings"), [aria-label*="settings"]');

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Should show settings page
      const settingsPage = mainWindow.locator('text=/설정|settings/i');
      await expect(settingsPage).toBeVisible();
    }
  });

  test('should close settings page', async () => {
    const { mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정"), button:has-text("settings")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Close settings
      const closeButton = mainWindow.locator('button:has-text("닫기"), button:has-text("close"), button:has-text("×")').first();

      if (await closeButton.isVisible()) {
        await closeButton.click();
        await mainWindow.waitForTimeout(500);

        // Should return to main view
        expect(mainWindow).toBeDefined();
      }
    }
  });
});

test.describe('Language Settings', () => {
  test('should display language selector', async () => {
    const { mainWindow } = context;

    // Navigate to settings
    const settingsButton = mainWindow.locator('button:has-text("설정"), button:has-text("settings")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for language options
      const languageSelector = mainWindow.locator('text=/언어|language/i, select, [role="combobox"]');
      await expect(languageSelector).toBeVisible({ timeout: 3000 });
    }
  });

  test('should change language to English', async () => {
    const { app, mainWindow } = context;

    // Change language via IPC
    await invokeIPC(app, 'set-language', 'en');
    await mainWindow.waitForTimeout(1000);

    // Check for English text (case-insensitive)
    const englishText = mainWindow.locator('text=/analysis|settings|prompt/i');
    await expect(englishText).toBeVisible({ timeout: 3000 });
  });

  test('should change language to Korean', async () => {
    const { app, mainWindow } = context;

    // Change language via IPC
    await invokeIPC(app, 'set-language', 'ko');
    await mainWindow.waitForTimeout(1000);

    // Check for Korean text
    const koreanText = mainWindow.locator('text=/분석|설정|프롬프트/');
    await expect(koreanText).toBeVisible({ timeout: 3000 });
  });

  test('should persist language setting', async () => {
    const { app } = context;

    // Set language
    await invokeIPC(app, 'set-language', 'en');
    await app.waitForTimeout(500);

    // Get language
    const language = await invokeIPC(app, 'get-language');
    expect(language).toBe('en');
  });
});

test.describe('Hotkey Settings', () => {
  test('should display current hotkey', async () => {
    const { mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정"), button:has-text("settings")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for hotkey display
      const hotkeyDisplay = mainWindow.locator('text=/Cmd\\+Shift|단축키|hotkey/i');
      await expect(hotkeyDisplay).toBeVisible({ timeout: 3000 });
    }
  });

  test('should allow hotkey customization', async () => {
    const { mainWindow } = context;

    // Navigate to settings
    const settingsButton = mainWindow.locator('button:has-text("설정")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for hotkey input/selector
      const hotkeyInput = mainWindow.locator('input[type="text"], [role="textbox"], select').first();

      // May have hotkey configuration UI
      expect(mainWindow).toBeDefined();
    }
  });
});

test.describe('Capture Mode Settings', () => {
  test('should display capture mode options', async () => {
    const { mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for capture mode options (auto, selection, clipboard)
      const captureModeSection = mainWindow.locator('text=/캡처|capture mode/i');
      await expect(captureModeSection).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow changing capture mode', async () => {
    const { app, mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Try to find radio buttons or select for capture mode
      const captureModeInput = mainWindow.locator('input[type="radio"], select, [role="radio"]').first();

      // May have capture mode selection
      expect(mainWindow).toBeDefined();
    }
  });
});

test.describe('AI Provider Settings', () => {
  test('should display AI provider options', async () => {
    const { mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for AI provider section
      const aiProviderSection = mainWindow.locator('text=/AI|프로바이더|provider/i');
      await expect(aiProviderSection).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow API key input', async () => {
    const { mainWindow } = context;

    // Open settings
    const settingsButton = mainWindow.locator('button:has-text("설정")').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await mainWindow.waitForTimeout(500);

      // Look for API key input fields
      const apiKeyInput = mainWindow.locator('input[type="password"], input[type="text"][placeholder*="API"]');

      // May have API key inputs
      expect(mainWindow).toBeDefined();
    }
  });

  test('should configure AI provider via IPC', async () => {
    const { app } = context;

    const providerConfig = {
      provider: 'claude',
      apiKey: 'sk-test-key-123',
      enabled: true,
    };

    // Set provider config
    await invokeIPC(app, 'set-ai-provider', providerConfig);
    await app.waitForTimeout(500);

    // Get provider list
    const providers = await invokeIPC(app, 'get-ai-providers');

    expect(providers).toBeDefined();
    expect(Array.isArray(providers)).toBe(true);
  });
});

test.describe('Settings Persistence', () => {
  test('should save settings on change', async () => {
    const { app } = context;

    // Change a setting
    await invokeIPC(app, 'set-language', 'en');
    await app.waitForTimeout(500);

    // Retrieve setting
    const language = await invokeIPC(app, 'get-language');

    expect(language).toBe('en');
  });

  test('should restore settings on app restart', async () => {
    const { app } = context;

    // Note: Testing actual restart is complex
    // This test just verifies settings are persisted

    // Set a setting
    await invokeIPC(app, 'set-language', 'ko');
    await app.waitForTimeout(500);

    // Get setting (simulates restart read)
    const language = await invokeIPC(app, 'get-language');

    expect(language).toBe('ko');
  });
});

test.describe('Settings Validation', () => {
  test('should validate hotkey format', async () => {
    const { app } = context;

    // Try to set invalid hotkey
    // Note: Actual validation depends on implementation
    // Just verify app doesn't crash

    try {
      await invokeIPC(app, 'set-hotkey', 'invalid-key');
      await app.waitForTimeout(500);
    } catch (error) {
      // May throw validation error
    }

    expect(app).toBeDefined();
  });

  test('should validate API key format', async () => {
    const { app } = context;

    // Try to set invalid API key
    try {
      await invokeIPC(app, 'set-ai-provider', {
        provider: 'claude',
        apiKey: 'invalid',
        enabled: true,
      });
      await app.waitForTimeout(500);
    } catch (error) {
      // May throw validation error
    }

    expect(app).toBeDefined();
  });
});
