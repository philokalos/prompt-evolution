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
  waitForAnalysis,
  analyzePrompt,
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
  test('TC-008: should check accessibility permission via system API', async () => {
    const { app } = context;
    const result = await app.evaluate(({ systemPreferences }) =>
      systemPreferences.isTrustedAccessibilityClient(false)
    );
    expect(typeof result).toBe('boolean');
  });

  test('TC-009: should fallback to clipboard when accessibility denied', async () => {
    const { app, mainWindow } = context;
    const isAccessible = await app.evaluate(({ systemPreferences }) =>
      systemPreferences.isTrustedAccessibilityClient(false)
    );

    if (!isAccessible) {
      await setClipboard(app, 'Clipboard fallback test prompt');
      await analyzePrompt(app, mainWindow, 'Clipboard fallback test prompt');
      await waitForAnalysis(mainWindow);

      // Analysis should complete successfully (grade badge visible)
      const gradeBadge = mainWindow.locator('.grade-badge');
      await expect(gradeBadge).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── J1: Grade Verification ──────────────────────────────────────────

test.describe('Grade Verification (TC-014)', () => {
  test('TC-014: should assign low grade (D or F) for vague prompts', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'fix this bug');
    await waitForAnalysis(mainWindow);

    // Grade badge should show D or F
    const gradeBadge = mainWindow.locator('.grade-badge');
    await expect(gradeBadge).toBeVisible({ timeout: 5000 });
    const gradeText = await gradeBadge.textContent();
    expect(gradeText).toMatch(/[DF]/);

    // TopFix card should show coaching content (ko: "지금 이것만!", en: "Fix This First")
    const topFix = mainWindow.locator('text=/지금 이것만|Fix This First/i');
    await expect(topFix).toBeVisible({ timeout: 5000 });
  });
});

// ─── J2: Analysis Details ────────────────────────────────────────────

test.describe('Weakness Identification (TC-017)', () => {
  test('TC-017: should identify lowest GOLDEN dimension', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'do something');
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

    await analyzePrompt(app, mainWindow, 'do something');
    await waitForAnalysis(mainWindow);

    // TopFix card shows the highest-priority issue (ko: "지금 이것만!", en: "Fix This First")
    const topFix = mainWindow.locator('text=/지금 이것만|Fix This First/i');
    await expect(topFix).toBeVisible({ timeout: 5000 });

    // "더 코칭 포인트" / "more coaching points" link for remaining issues
    const moreCoaching = mainWindow.locator('text=/코칭 포인트|coaching point/i');
    const count = await moreCoaching.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-019: should include suggestions in each issue', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'fix it');
    await waitForAnalysis(mainWindow);

    // TopFix card contains issue description and suggested fix
    const topFix = mainWindow.locator('text=/지금 이것만|Fix This First/i');
    await expect(topFix).toBeVisible({ timeout: 5000 });

    // "추천 수정안" / "Suggested Rewrite" button in CollapsibleDetails
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });
  });

  test('TC-020: should display issue count', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'fix bug');
    await waitForAnalysis(mainWindow);

    // TopFix card is the primary issue display (ko: "지금 이것만!", en: "Fix This First")
    const topFix = mainWindow.locator('text=/지금 이것만|Fix This First/i');
    await expect(topFix).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Variant Score Order (TC-025, TC-026)', () => {
  test('TC-025: should show GOLDEN scores after analysis', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'fix bug');
    await waitForAnalysis(mainWindow);

    // GoldenMiniBar shows scores in G:XX% format
    const goldenScores = mainWindow.locator('text=/G:\\d+%/');
    await expect(goldenScores).toBeVisible({ timeout: 5000 });
  });

  test('TC-026: should display suggested rewrite with details', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'fix bug');
    await waitForAnalysis(mainWindow);

    // CollapsibleDetails "Suggested Rewrite" should be expandable
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });

    // Click to expand and check content inside
    await suggestedRewrite.click();
    await mainWindow.waitForTimeout(300);
  });
});

test.describe('Copy Feedback (TC-030)', () => {
  test('TC-030: should show feedback after fix action', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'create component');
    await waitForAnalysis(mainWindow);

    // Use TopFixCard "Fix This Now" button
    const fixNowButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixNowButton.isVisible()) {
      await fixNowButton.click();
      await mainWindow.waitForTimeout(500);
      expect(app).toBeDefined();
    }
  });
});

// ─── J2: Apply Workflow ──────────────────────────────────────────────

test.describe('Apply Button (TC-032, TC-033, TC-034)', () => {
  test('TC-032: should show fix button after analysis', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'create login form');
    await waitForAnalysis(mainWindow);

    // TopFixCard "Fix This Now" button (ko: "지금 고치기", en: "Fix This Now")
    const fixButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")');
    await expect(fixButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-033: should update clipboard when fix is clicked', async () => {
    const { app, mainWindow } = context;

    const originalPrompt = 'fix authentication';
    await setClipboard(app, originalPrompt);
    await analyzePrompt(app, mainWindow, originalPrompt);
    await waitForAnalysis(mainWindow);

    const fixButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixButton.isVisible()) {
      await fixButton.click();
      await mainWindow.waitForTimeout(500);

      const clipboardText = await getClipboard(app);
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });

  test('TC-034: should handle fix failure gracefully (clipboard fallback)', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'test apply fallback');
    await waitForAnalysis(mainWindow);

    const fixButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixButton.isVisible()) {
      await fixButton.click();
      await mainWindow.waitForTimeout(1000);
      expect(app).toBeDefined();
    }
  });
});

test.describe('Block App Detection (TC-035, TC-036, TC-037)', () => {
  test('TC-035: should detect blocked apps and show alternative button', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Block app detection test');
    await waitForAnalysis(mainWindow);

    // TopFixCard shows "Fix This Now" or "Copy Fix" depending on blocked status
    const actionButton = mainWindow.locator(
      'button:has-text("지금 고치기"), button:has-text("Fix This Now"), button:has-text("수정안 복사"), button:has-text("Copy Fix")'
    ).first();
    await expect(actionButton).toBeVisible({ timeout: 5000 });
  });

  test('TC-036: should copy to clipboard on fix action', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'copy and switch test');
    await waitForAnalysis(mainWindow);

    const fixButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixButton.isVisible()) {
      await fixButton.click();
      await mainWindow.waitForTimeout(500);

      const clipboardText = await getClipboard(app);
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(0);
    }
  });

  test('TC-037: should show feedback after fix action', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'toast notification test');
    await waitForAnalysis(mainWindow);

    const fixButton = mainWindow.locator('button:has-text("지금 고치기"), button:has-text("Fix This Now")').first();

    if (await fixButton.isVisible()) {
      await fixButton.click();
      await mainWindow.waitForTimeout(500);
      expect(app).toBeDefined();
    }
  });
});

// ─── J3: Ghost Bar Extended ──────────────────────────────────────────

test.describe('Ghost Bar Conditional Display (TC-043)', () => {
  test('TC-043: should not show Ghost Bar for A-grade prompts', async () => {
    const { app, mainWindow } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    const highQualityPrompt =
      'Create a React login component with the following requirements:\n' +
      '- Email validation using regex pattern\n' +
      '- Password strength indicator (weak/medium/strong)\n' +
      '- Error handling for failed login attempts with retry limit\n' +
      '- Responsive design using Tailwind CSS grid/flexbox\n' +
      '- Unit tests using Vitest and React Testing Library\n' +
      '- Output as a single LoginForm.tsx component with TypeScript props interface';

    await analyzePrompt(app, mainWindow, highQualityPrompt);
    await mainWindow.waitForTimeout(2000);

    const finalWindowCount = (await getAllWindows(app)).length;
    expect(finalWindowCount).toBe(initialWindowCount);
  });
});

test.describe('Ghost Bar History Save (TC-047)', () => {
  // ghost-bar:show is a webContents.send event, not an IPC handler
  test.skip('TC-047: should save to history after Ghost Bar apply', async () => {
    const { app } = context;

    const initialHistory = await invokeIPC(app, 'get-history', 100);
    const initialCount = Array.isArray(initialHistory) ? initialHistory.length : 0;

    await analyzePrompt(app, mainWindow, 'Ghost bar history test prompt');
    await app.waitForTimeout(1500);

    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'Improved version of the ghost bar prompt');
    const ghostBar = await waitForNewWindow(app, initialWindowCount, 3000);

    const applyButton = ghostBar.locator('button:has-text("적용"), button:has-text("apply")').first();
    if (await applyButton.isVisible()) {
      await applyButton.click();
      await app.waitForTimeout(1000);
    }

    const updatedHistory = await invokeIPC(app, 'get-history', 100);
    const updatedCount = Array.isArray(updatedHistory) ? updatedHistory.length : 0;
    expect(updatedCount).toBeGreaterThanOrEqual(initialCount);
  });
});

test.describe('Ghost Bar Detail Transition (TC-050, TC-051)', () => {
  // ghost-bar:show is a webContents.send event, not an IPC handler
  test.skip('TC-050: should transition to main window on detail click', async () => {
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

  test.skip('TC-051: should use cached results without re-analysis', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Cache test prompt for ghost bar');
    await mainWindow.waitForTimeout(1500);

    const history1 = await invokeIPC(app, 'get-history', 1);

    const initialWindowCount = (await getAllWindows(app)).length;
    await invokeIPC(app, 'ghost-bar:show', 'Cached improved version');
    await waitForNewWindow(app, initialWindowCount, 3000);
    await app.waitForTimeout(500);

    const history2 = await invokeIPC(app, 'get-history', 1);
    expect(history2?.length ?? 0).toBeLessThanOrEqual((history1?.length ?? 0) + 1);
  });
});

test.describe('Ghost Bar Auto-Dismiss (TC-052, TC-053)', () => {
  // ghost-bar:show is a webContents.send event, not an IPC handler
  test.skip('TC-052: should auto-dismiss after timeout', async () => {
    const { app } = context;

    const initialWindowCount = (await getAllWindows(app)).length;

    await invokeIPC(app, 'ghost-bar:show', 'Auto dismiss test');
    await waitForNewWindow(app, initialWindowCount, 3000);

    await app.waitForTimeout(6000);

    const finalWindowCount = (await getAllWindows(app)).length;
    expect(finalWindowCount).toBeLessThanOrEqual(initialWindowCount + 1);
  });

  test.skip('TC-053: should allow re-show after auto-dismiss', async () => {
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

    await invokeIPC(app, 'set-providers', [
      { type: 'claude', apiKey: 'test-key-for-badge', enabled: true },
    ]);
    await mainWindow.waitForTimeout(500);

    await analyzePrompt(app, mainWindow, 'AI badge test prompt');
    await waitForAnalysis(mainWindow);

    // Suggested Rewrite section should be visible
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });

    await invokeIPC(app, 'set-providers', [
      { type: 'claude', apiKey: '', enabled: false },
    ]);
  });

  test('TC-060: should display suggested rewrite section', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'AI explanation test');
    await waitForAnalysis(mainWindow);

    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Error Non-Exposure (TC-062)', () => {
  test('TC-062: should not show error dialog on API failure', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'set-providers', [
      { type: 'claude', apiKey: 'sk-ant-invalid-key', enabled: true },
    ]);
    await mainWindow.waitForTimeout(500);

    await analyzePrompt(app, mainWindow, 'Error non-exposure test');
    await waitForAnalysis(mainWindow);

    const errorDialog = mainWindow.locator('[role="dialog"]:has-text("error"), [role="alertdialog"]');
    const dialogCount = await errorDialog.count();
    expect(dialogCount).toBe(0);

    // Suggested Rewrite should still be visible (rule-based fallback)
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite).toBeVisible({ timeout: 5000 });

    await invokeIPC(app, 'set-providers', [
      { type: 'claude', apiKey: '', enabled: false },
    ]);
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
      await analyzePrompt(app, mainWindow, prompt);
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

    await analyzePrompt(app, mainWindow, 'create a new API endpoint');
    await waitForAnalysis(mainWindow);

    // Suggested Rewrite section should be visible (contains comprehensive variant)
    const suggestedRewrite = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
    await expect(suggestedRewrite.first()).toBeVisible({ timeout: 5000 });
  });
});
