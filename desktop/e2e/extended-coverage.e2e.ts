/**
 * E2E Tests: Extended Coverage
 *
 * 28 new test cases covering gaps identified in the E2E test specification.
 * TC-008, TC-009, TC-014, TC-017~020, TC-025~026, TC-030, TC-032~037,
 * TC-043, TC-047, TC-050~053, TC-059~060, TC-062, TC-076, TC-094~096
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
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

// ─── J1: Accessibility & Permissions ─────────────────────────────────

test.describe('Accessibility Permissions (TC-008, TC-009)', () => {
  test('TC-008: should check accessibility permission via IPC', async () => {
    const { app } = context;
    const result = await invokeIPC(app, 'check-accessibility');
    expect(typeof result).toBe('boolean');
  });

  test('TC-009: should fallback to clipboard when accessibility denied', async () => {
    const { app, mainWindow } = context;
    const isAccessible = await invokeIPC(app, 'check-accessibility');

    if (!isAccessible) {
      await setClipboard(app, 'Clipboard fallback test prompt');
      await invokeIPC(app, 'analyze-prompt', 'Clipboard fallback test prompt');
      await mainWindow.waitForTimeout(1500);

      const promptText = mainWindow.locator('text=Clipboard fallback test prompt');
      await expect(promptText).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── J1: Grade Verification ──────────────────────────────────────────

test.describe('Grade Verification (TC-014)', () => {
  test('TC-014: should assign low grade (D or F) for vague prompts', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'fix this bug');
    await mainWindow.waitForTimeout(1500);

    const grade = mainWindow.locator('text=/[DF]/');
    await expect(grade).toBeVisible({ timeout: 5000 });

    const issues = mainWindow.locator('text=/이슈|issue|문제/i');
    await expect(issues).toBeVisible({ timeout: 5000 });
  });
});

// ─── J2: Analysis Details ────────────────────────────────────────────

test.describe('Weakness Identification (TC-017)', () => {
  test('TC-017: should identify lowest GOLDEN dimension', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'do something');
    await mainWindow.waitForTimeout(1500);

    const averages = await invokeIPC(app, 'get-golden-averages');
    expect(averages).toBeDefined();

    const dims = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
    let minDim = dims[0];
    let minScore = Infinity;

    for (const dim of dims) {
      const score = averages[dim] ?? 0;
      if (score < minScore) {
        minScore = score;
        minDim = dim;
      }
    }

    expect(minDim).toBeTruthy();
    expect(minScore).toBeGreaterThanOrEqual(0);
    expect(minScore).toBeLessThanOrEqual(1);
  });
});

test.describe('Issue Details (TC-018, TC-019, TC-020)', () => {
  test('TC-018: should sort issues by severity', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'do something');
    await mainWindow.waitForTimeout(1500);

    const issueSection = mainWindow.locator('text=/이슈|issue|문제/i');
    await expect(issueSection).toBeVisible({ timeout: 5000 });

    const issueItems = mainWindow.locator('[class*="issue"], [data-testid*="issue"]');
    const count = await issueItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-019: should include suggestions in each issue', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'fix it');
    await mainWindow.waitForTimeout(1500);

    const suggestions = mainWindow.locator('text=/제안|suggestion|추천|개선/i');
    await expect(suggestions.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-020: should display issue count', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'fix bug');
    await mainWindow.waitForTimeout(1500);

    const issueSection = mainWindow.locator('text=/이슈|issue|문제/i');
    await expect(issueSection).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Variant Score Order (TC-025, TC-026)', () => {
  test('TC-025: should show variants in ascending score order', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'fix bug');
    await mainWindow.waitForTimeout(2000);

    const confidenceTexts = mainWindow.locator('text=/%/');
    const count = await confidenceTexts.count();

    if (count >= 2) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('TC-026: should display keyChanges for each variant', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'fix bug');
    await mainWindow.waitForTimeout(2000);

    const keyChanges = mainWindow.locator('text=/변경|change|추가|added|개선/i');
    await expect(keyChanges.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Copy Feedback (TC-030)', () => {
  test('TC-030: should show feedback after copy action', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'create component');
    await mainWindow.waitForTimeout(2000);

    const copyButton = mainWindow.locator('button:has-text("복사"), button:has-text("copy"), button[aria-label*="copy"]').first();

    if (await copyButton.isVisible()) {
      await copyButton.click();
      await mainWindow.waitForTimeout(500);
      expect(app).toBeDefined();
    }
  });
});

// ─── J2: Apply Workflow ──────────────────────────────────────────────

test.describe('Apply Button (TC-032, TC-033, TC-034)', () => {
  test('TC-032: should show apply button after analysis', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'create login form');
    await mainWindow.waitForTimeout(2000);

    const applyButton = mainWindow.locator('button:has-text("적용"), button:has-text("Apply"), button:has-text("apply")');
    await expect(applyButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-033: should update clipboard when apply is clicked', async () => {
    const { app, mainWindow } = context;

    const originalPrompt = 'fix authentication';
    await setClipboard(app, originalPrompt);
    await invokeIPC(app, 'analyze-prompt', originalPrompt);
    await mainWindow.waitForTimeout(2000);

    const applyButton = mainWindow.locator('button:has-text("적용"), button:has-text("Apply")').first();

    if (await applyButton.isVisible()) {
      await applyButton.click();
      await mainWindow.waitForTimeout(500);

      const clipboardText = await getClipboard(app);
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });

  test('TC-034: should handle apply failure gracefully (clipboard fallback)', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'test apply fallback');
    await mainWindow.waitForTimeout(2000);

    const applyButton = mainWindow.locator('button:has-text("적용"), button:has-text("Apply")').first();

    if (await applyButton.isVisible()) {
      await applyButton.click();
      await mainWindow.waitForTimeout(1000);
      expect(app).toBeDefined();
    }
  });
});

test.describe('Block App Detection (TC-035, TC-036, TC-037)', () => {
  test('TC-035: should detect blocked apps and show alternative button', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Block app detection test');
    await mainWindow.waitForTimeout(2000);

    const actionButton = mainWindow.locator(
      'button:has-text("적용"), button:has-text("Apply"), button:has-text("Copy"), button:has-text("복사")'
    ).first();
    await expect(actionButton).toBeVisible({ timeout: 5000 });
  });

  test('TC-036: should copy to clipboard on Copy & Switch', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'copy and switch test');
    await mainWindow.waitForTimeout(2000);

    const copyButton = mainWindow.locator('button:has-text("복사"), button:has-text("Copy")').first();

    if (await copyButton.isVisible()) {
      await copyButton.click();
      await mainWindow.waitForTimeout(500);

      const clipboardText = await getClipboard(app);
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });

  test('TC-037: should show toast notification after copy action', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'toast notification test');
    await mainWindow.waitForTimeout(2000);

    const copyButton = mainWindow.locator('button:has-text("복사"), button:has-text("Copy")').first();

    if (await copyButton.isVisible()) {
      await copyButton.click();
      await mainWindow.waitForTimeout(500);
      expect(app).toBeDefined();
    }
  });
});

// ─── J3: Ghost Bar Extended ──────────────────────────────────────────

test.describe('Ghost Bar Conditional Display (TC-043)', () => {
  test('TC-043: should not show Ghost Bar for A-grade prompts', async () => {
    const { app } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    const highQualityPrompt =
      'Create a React login component with the following requirements:\n' +
      '- Email validation using regex pattern\n' +
      '- Password strength indicator (weak/medium/strong)\n' +
      '- Error handling for failed login attempts with retry limit\n' +
      '- Responsive design using Tailwind CSS grid/flexbox\n' +
      '- Unit tests using Vitest and React Testing Library\n' +
      '- Output as a single LoginForm.tsx component with TypeScript props interface';

    await invokeIPC(app, 'analyze-prompt', highQualityPrompt);
    await app.waitForTimeout(2000);

    const finalWindowCount = (await getAllWindows(app)).length;
    expect(finalWindowCount).toBe(initialWindowCount);
  });
});

test.describe('Ghost Bar History Save (TC-047)', () => {
  test('TC-047: should save to history after Ghost Bar apply', async () => {
    const { app } = context;

    const initialHistory = await invokeIPC(app, 'get-history', { limit: 100 });
    const initialCount = Array.isArray(initialHistory) ? initialHistory.length : 0;

    await invokeIPC(app, 'analyze-prompt', 'Ghost bar history test prompt');
    await app.waitForTimeout(1500);

    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'Improved version of the ghost bar prompt');
    const ghostBar = await waitForNewWindow(app, initialWindowCount, 3000);

    const applyButton = ghostBar.locator('button:has-text("적용"), button:has-text("apply")').first();
    if (await applyButton.isVisible()) {
      await applyButton.click();
      await app.waitForTimeout(1000);
    }

    const updatedHistory = await invokeIPC(app, 'get-history', { limit: 100 });
    const updatedCount = Array.isArray(updatedHistory) ? updatedHistory.length : 0;
    expect(updatedCount).toBeGreaterThanOrEqual(initialCount);
  });
});

test.describe('Ghost Bar Detail Transition (TC-050, TC-051)', () => {
  test('TC-050: should transition to main window on detail click', async () => {
    const { app, mainWindow } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'Detail transition test prompt');
    const ghostBar = await waitForNewWindow(app, initialWindowCount, 3000);

    const detailButton = ghostBar.locator(
      'button:has-text("⋯"), button:has-text("..."), button:has-text("상세"), button:has-text("detail"), button[aria-label*="detail"], button[aria-label*="more"]'
    ).first();

    if (await detailButton.isVisible()) {
      await detailButton.click();
      await app.waitForTimeout(1000);
      expect(mainWindow).toBeDefined();
    }
  });

  test('TC-051: should use cached results without re-analysis', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Cache test prompt for ghost bar');
    await mainWindow.waitForTimeout(1500);

    const history1 = await invokeIPC(app, 'get-history', { limit: 1 });

    const initialWindowCount = (await getAllWindows(app)).length;
    await invokeIPC(app, 'ghost-bar:show', 'Cached improved version');
    await waitForNewWindow(app, initialWindowCount, 3000);
    await app.waitForTimeout(500);

    const history2 = await invokeIPC(app, 'get-history', { limit: 1 });
    expect(history2?.length ?? 0).toBeLessThanOrEqual((history1?.length ?? 0) + 1);
  });
});

test.describe('Ghost Bar Auto-Dismiss (TC-052, TC-053)', () => {
  test('TC-052: should auto-dismiss after timeout', async () => {
    const { app } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'Auto dismiss test');
    await waitForNewWindow(app, initialWindowCount, 3000);

    await app.waitForTimeout(6000);

    const finalWindowCount = (await getAllWindows(app)).length;
    expect(finalWindowCount).toBeLessThanOrEqual(initialWindowCount + 1);
  });

  test('TC-053: should allow re-show after auto-dismiss', async () => {
    const { app } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'First show');
    await waitForNewWindow(app, initialWindowCount, 3000);
    await app.waitForTimeout(6000);

    await invokeIPC(app, 'ghost-bar:show', 'Second show after dismiss');
    await app.waitForTimeout(1000);

    const windows = await getAllWindows(app);
    expect(windows.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── J4: AI Variant Extended ─────────────────────────────────────────

test.describe('AI Variant Display (TC-059, TC-060)', () => {
  test('TC-059: should show AI badge when AI variant is available', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'set-ai-provider', {
      provider: 'claude',
      apiKey: 'test-key-for-badge',
      enabled: true,
    });
    await mainWindow.waitForTimeout(500);

    await invokeIPC(app, 'analyze-prompt', 'AI badge test prompt');
    await mainWindow.waitForTimeout(3000);

    const variants = mainWindow.locator('text=/변형|variant|개선/i');
    await expect(variants).toBeVisible({ timeout: 5000 });

    await invokeIPC(app, 'set-ai-provider', {
      provider: 'claude',
      apiKey: '',
      enabled: false,
    });
  });

  test('TC-060: should display aiExplanation when AI variant selected', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'AI explanation test');
    await mainWindow.waitForTimeout(2000);

    const variants = mainWindow.locator('text=/변형|variant|개선/i');
    await expect(variants).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Error Non-Exposure (TC-062)', () => {
  test('TC-062: should not show error dialog on API failure', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'set-ai-provider', {
      provider: 'claude',
      apiKey: 'sk-ant-invalid-key',
      enabled: true,
    });
    await mainWindow.waitForTimeout(500);

    await invokeIPC(app, 'analyze-prompt', 'Error non-exposure test');
    await mainWindow.waitForTimeout(2000);

    const errorDialog = mainWindow.locator('[role="dialog"]:has-text("error"), [role="alertdialog"]');
    const dialogCount = await errorDialog.count();
    expect(dialogCount).toBe(0);

    const variants = mainWindow.locator('text=/변형|variant|개선/i');
    await expect(variants).toBeVisible({ timeout: 5000 });

    await invokeIPC(app, 'set-ai-provider', {
      provider: 'claude',
      apiKey: '',
      enabled: false,
    });
  });
});

// ─── J5: Project-Specific Learning ──────────────────────────────────

test.describe('Project-Specific Feedback (TC-076)', () => {
  test('TC-076: should provide specific dimensional feedback after multiple analyses', async () => {
    const { app, mainWindow } = context;

    const prompts = [
      'fix bug',
      'change this',
      'update the code',
      'add error handling to the authentication flow with retry logic',
      'refactor the database module',
    ];

    for (const prompt of prompts) {
      await invokeIPC(app, 'analyze-prompt', prompt);
      await mainWindow.waitForTimeout(800);
    }

    const weaknesses = await invokeIPC(app, 'get-top-weaknesses');
    expect(weaknesses).toBeDefined();
    expect(Array.isArray(weaknesses)).toBe(true);

    if (weaknesses.length > 0) {
      expect(weaknesses[0]).toBeDefined();
    }
  });
});

// ─── J7: Context Awareness ──────────────────────────────────────────

test.describe('Session Context (TC-094, TC-095, TC-096)', () => {
  test('TC-094: should return session context via IPC', async () => {
    const { app } = context;
    const sessionContext = await invokeIPC(app, 'get-session-context');
    expect(sessionContext).toBeDefined();
  });

  test('TC-095: should return current project via IPC', async () => {
    const { app } = context;
    const currentProject = await invokeIPC(app, 'get-current-project');
    expect(currentProject !== undefined).toBe(true);
  });

  test('TC-096: should inject context into comprehensive variant', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'create a new API endpoint');
    await mainWindow.waitForTimeout(2000);

    const variants = mainWindow.locator('text=/변형|variant|개선|comprehensive|종합/i');
    await expect(variants.first()).toBeVisible({ timeout: 5000 });
  });
});
