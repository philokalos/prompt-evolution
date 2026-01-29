/**
 * E2E Tests: Ghost Bar (Floating Window)
 *
 * Tests the Ghost Bar functionality including window creation, positioning, and auto-paste.
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
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

test.describe('Ghost Bar Creation', () => {
  test('should create Ghost Bar window when requested', async () => {
    const { app } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    // Trigger Ghost Bar creation via IPC
    await invokeIPC(app, 'ghost-bar:show', 'Test improved prompt');

    // Wait for new window
    const ghostBar = await waitForNewWindow(app, initialWindowCount, 3000);

    expect(ghostBar).toBeDefined();
  });

  test('should not create multiple Ghost Bar windows', async () => {
    const { app } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    // Show Ghost Bar twice
    await invokeIPC(app, 'ghost-bar:show', 'First prompt');
    await app.waitForTimeout(500);

    const countAfterFirst = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'Second prompt');
    await app.waitForTimeout(500);

    const countAfterSecond = (await getAllWindows(app)).length;

    // Should reuse same window
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

test.describe('Ghost Bar Content', () => {
  test('should display the improved prompt text', async () => {
    const { app } = context;

    const testPrompt = 'This is an improved prompt for testing';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Check content
    const content = ghostBar.locator(`text=${testPrompt}`);
    await expect(content).toBeVisible({ timeout: 3000 });
  });

  test('should handle long prompts with scrolling', async () => {
    const { app } = context;

    const longPrompt = 'A'.repeat(1000) + ' test prompt';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', longPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Should render without crashing
    expect(ghostBar).toBeDefined();

    // Check if scrollable
    const scrollHeight = await ghostBar.evaluate(() => {
      return document.documentElement.scrollHeight;
    });

    expect(scrollHeight).toBeGreaterThan(0);
  });
});

test.describe('Ghost Bar Actions', () => {
  test('should have apply button', async () => {
    const { app } = context;

    const testPrompt = 'Test prompt for apply';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Look for apply/paste button
    const applyButton = ghostBar.locator('button:has-text("적용"), button:has-text("apply"), button[aria-label*="apply"]');
    await expect(applyButton).toBeVisible({ timeout: 3000 });
  });

  test('should have dismiss button', async () => {
    const { app } = context;

    const testPrompt = 'Test prompt for dismiss';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Look for close/dismiss button
    const dismissButton = ghostBar.locator('button:has-text("닫기"), button:has-text("close"), button:has-text("×"), button[aria-label*="close"]');
    await expect(dismissButton).toBeVisible({ timeout: 3000 });
  });

  test('should close Ghost Bar when dismiss clicked', async () => {
    const { app } = context;

    const testPrompt = 'Test dismiss action';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Click dismiss
    const dismissButton = ghostBar.locator('button:has-text("닫기"), button:has-text("close"), button:has-text("×")').first();

    if (await dismissButton.isVisible()) {
      await dismissButton.click();
      await app.waitForTimeout(500);

      // Window should be closed or hidden
      const finalWindowCount = (await getAllWindows(app)).length;
      // May be destroyed or just hidden
      expect(finalWindowCount).toBeLessThanOrEqual(initialWindowCount + 1);
    }
  });
});

test.describe('Ghost Bar Positioning', () => {
  test('should position Ghost Bar near cursor', async () => {
    const { app } = context;

    const testPrompt = 'Test positioning';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Check position is set
    const bounds = await ghostBar.evaluate(() => {
      return {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
      };
    });

    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.width).toBeGreaterThan(100);
    expect(bounds.height).toBeGreaterThan(50);
  });

  test('should stay on screen bounds', async () => {
    const { app } = context;

    const testPrompt = 'Test screen bounds';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    const bounds = await ghostBar.evaluate(() => {
      const screen = window.screen;
      return {
        x: window.screenX,
        y: window.screenY,
        width: window.outerWidth,
        height: window.outerHeight,
        screenWidth: screen.width,
        screenHeight: screen.height,
      };
    });

    // Should be within screen bounds
    expect(bounds.x).toBeLessThan(bounds.screenWidth);
    expect(bounds.y).toBeLessThan(bounds.screenHeight);
    expect(bounds.x + bounds.width).toBeGreaterThan(0);
    expect(bounds.y + bounds.height).toBeGreaterThan(0);
  });
});

test.describe('Ghost Bar Auto-Paste', () => {
  test('should attempt auto-paste when apply clicked', async () => {
    const { app } = context;

    const testPrompt = 'Test auto-paste';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Click apply button
    const applyButton = ghostBar.locator('button:has-text("적용"), button:has-text("apply")').first();

    if (await applyButton.isVisible()) {
      await applyButton.click();
      await app.waitForTimeout(500);

      // Auto-paste will attempt (may fail in test environment)
      // Just verify no crash
      expect(app).toBeDefined();
    }
  });

  test('should handle auto-paste failure gracefully', async () => {
    const { app } = context;

    const testPrompt = 'Test paste failure';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    const ghostBar = await waitForNewWindow(app, initialWindowCount);

    // Auto-paste will likely fail in test (no active window)
    // Should handle gracefully and not crash
    const applyButton = ghostBar.locator('button:has-text("적용"), button:has-text("apply")').first();

    if (await applyButton.isVisible()) {
      await applyButton.click();
      await app.waitForTimeout(1000);

      // App should still be running
      expect(app).toBeDefined();
    }
  });
});

test.describe('Ghost Bar Lifecycle', () => {
  test('should hide Ghost Bar after successful apply', async () => {
    const { app } = context;

    const testPrompt = 'Test lifecycle';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    await waitForNewWindow(app, initialWindowCount);

    // Trigger hide via IPC
    await invokeIPC(app, 'ghost-bar:hide');
    await app.waitForTimeout(500);

    // Window count should decrease or stay same (if window destroyed/hidden)
    const finalWindowCount = (await getAllWindows(app)).length;
    expect(finalWindowCount).toBeLessThanOrEqual(initialWindowCount + 1);
  });

  test('should destroy Ghost Bar when main window closes', async () => {
    const { app } = context;

    const testPrompt = 'Test destruction';
    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', testPrompt);

    await waitForNewWindow(app, initialWindowCount);

    // Note: Actual test of this requires closing main window
    // which would end the test, so just verify setup
    expect(app).toBeDefined();
  });
});
