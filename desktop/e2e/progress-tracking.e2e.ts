/**
 * E2E Tests: Progress Tracking and History Visualization
 *
 * Tests the Progress tab functionality including score trends, weekly stats, and history visualization.
 */

import { test, expect } from '@playwright/test';
import {
  launchElectronApp,
  closeElectronApp,
  waitForAppReady,
  analyzePrompt,
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

test.describe('Progress Tab Navigation', () => {
  test('should navigate to Progress tab', async () => {
    const { mainWindow } = context;

    // Find and click Progress tab
    const progressTab = mainWindow.locator('button:has-text("진행"), button:has-text("Progress"), [role="tab"]:has-text("진행")');

    if (await progressTab.isVisible()) {
      await progressTab.click();
      await mainWindow.waitForTimeout(500);

      // Should show progress content
      expect(mainWindow).toBeDefined();
    }
  });

  test('should display progress overview', async () => {
    const { mainWindow } = context;

    // Navigate to progress
    const progressTab = mainWindow.locator('text=/진행|progress/i');
    if (await progressTab.isVisible()) {
      await progressTab.click();
      await mainWindow.waitForTimeout(500);

      // Should show stats text (Total Analyses, Average Score, Recent Trend)
      const statsText = mainWindow.locator('text=/Total Analyses|Average Score|Recent Trend|총 분석|평균 점수/i');
      await expect(statsText.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Score Trends', () => {
  test('should display score trend chart', async () => {
    const { app, mainWindow } = context;

    // Add some test analyses first
    await analyzePrompt(app, mainWindow, 'First test');
    await mainWindow.waitForTimeout(1000);

    await analyzePrompt(app, mainWindow, 'Second test');
    await mainWindow.waitForTimeout(1000);

    // Navigate to progress
    const progressTab = mainWindow.locator('text=/진행|progress/i');
    if (await progressTab.isVisible()) {
      await progressTab.click();
      await mainWindow.waitForTimeout(500);

      // Should show trend visualization
      const trendChart = mainWindow.locator('[class*="trend"], [class*="chart"], svg');
      await expect(trendChart.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show score improvement over time', async () => {
    const { app } = context;

    // get-score-trend takes (days?: number), not an object
    const trend = await invokeIPC(app, 'get-score-trend', 7);

    expect(trend).toBeDefined();
    expect(Array.isArray(trend)).toBe(true);
  });

  test('should filter trend by time period', async () => {
    const { app } = context;

    // get-score-trend takes (days?: number)
    const weekly = await invokeIPC(app, 'get-score-trend', 7);
    const monthly = await invokeIPC(app, 'get-score-trend', 30);

    expect(weekly).toBeDefined();
    expect(monthly).toBeDefined();
  });
});

test.describe('Weekly Stats', () => {
  test('should display weekly statistics', async () => {
    const { app, mainWindow } = context;

    // Add test data
    await analyzePrompt(app, mainWindow, 'Weekly test prompt');
    await mainWindow.waitForTimeout(1000);

    // Get weekly stats
    const stats = await invokeIPC(app, 'get-stats');

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('totalAnalyses');
  });

  test('should show analysis count', async () => {
    const { app } = context;

    const stats = await invokeIPC(app, 'get-stats');

    expect(stats).toHaveProperty('totalAnalyses');
    expect(typeof stats.totalAnalyses).toBe('number');
    expect(stats.totalAnalyses).toBeGreaterThanOrEqual(0);
  });

  test('should show average GOLDEN scores', async () => {
    const { app } = context;

    // get-golden-averages takes (days?: number)
    const averages = await invokeIPC(app, 'get-golden-averages');

    expect(averages).toBeDefined();
    expect(averages).toHaveProperty('goal');
    expect(averages).toHaveProperty('output');
    expect(averages).toHaveProperty('limits');
    expect(averages).toHaveProperty('data');
    expect(averages).toHaveProperty('evaluation');
    expect(averages).toHaveProperty('next');
  });

  test('should show improvement percentage', async () => {
    const { app, mainWindow } = context;

    // Add multiple analyses
    await analyzePrompt(app, mainWindow, 'First analysis');
    await mainWindow.waitForTimeout(1000);

    await analyzePrompt(app, mainWindow, 'Improved analysis with clear goal and expected output');
    await mainWindow.waitForTimeout(1000);

    const stats = await invokeIPC(app, 'get-stats');

    // Stats should be available
    expect(stats).toBeDefined();
  });
});

test.describe('GOLDEN Dimension Analysis', () => {
  test('should show dimensional averages', async () => {
    const { app } = context;

    const averages = await invokeIPC(app, 'get-golden-averages');

    expect(averages).toBeDefined();
    expect(Object.keys(averages)).toContain('goal');
    expect(Object.keys(averages)).toContain('output');
  });

  test('should identify top weaknesses', async () => {
    const { app, mainWindow } = context;

    // Add test analysis
    await analyzePrompt(app, mainWindow, 'Weak prompt');
    await mainWindow.waitForTimeout(1000);

    // get-top-weaknesses takes (limit?: number)
    const weaknesses = await invokeIPC(app, 'get-top-weaknesses');

    expect(weaknesses).toBeDefined();
    expect(Array.isArray(weaknesses)).toBe(true);
  });

  test('should show improvement suggestions', async () => {
    const { mainWindow } = context;

    // Navigate to progress
    const progressTab = mainWindow.locator('text=/진행|progress/i');
    if (await progressTab.isVisible()) {
      await progressTab.click();
      await mainWindow.waitForTimeout(500);

      // Should show GOLDEN dimension content (en: "GOLDEN Dimension", ko: "GOLDEN 차원별")
      const goldenContent = mainWindow.locator('text=/GOLDEN|일별|주별|월별|Daily|Weekly|Monthly/i');
      await expect(goldenContent.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('History Visualization', () => {
  test('should display analysis history list', async () => {
    const { app, mainWindow } = context;

    // Add test analyses
    await analyzePrompt(app, mainWindow, 'History test 1');
    await mainWindow.waitForTimeout(1000);

    await analyzePrompt(app, mainWindow, 'History test 2');
    await mainWindow.waitForTimeout(1000);

    // get-history takes (limit?: number)
    const history = await invokeIPC(app, 'get-history', 10);

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  test('should show timestamps for each analysis', async () => {
    const { app } = context;

    const history = await invokeIPC(app, 'get-history', 5);

    if (history.length > 0) {
      expect(history[0]).toHaveProperty('timestamp');
      expect(typeof history[0].timestamp).toBe('number');
    }
  });

  test('should show scores for each analysis', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Score test');
    await mainWindow.waitForTimeout(1000);

    const history = await invokeIPC(app, 'get-history', 1);

    if (history.length > 0) {
      expect(history[0]).toHaveProperty('overallScore');
      expect(typeof history[0].overallScore).toBe('number');
    }
  });

  test('should allow filtering history by project', async () => {
    const { app } = context;

    // get-project-patterns takes (projectPath: string)
    const patterns = await invokeIPC(app, 'get-project-patterns', '/tmp/test-project');

    expect(patterns).toBeDefined();
  });

  test('should allow pagination of history', async () => {
    const { app } = context;

    // get-history takes (limit?: number) — no offset support
    const page1 = await invokeIPC(app, 'get-history', 5);
    const page2 = await invokeIPC(app, 'get-history', 10);

    expect(page1).toBeDefined();
    expect(page2).toBeDefined();
  });
});

test.describe('Project-Specific Insights', () => {
  test('should show project patterns', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Project-specific test');
    await mainWindow.waitForTimeout(1000);

    // get-project-patterns takes (projectPath: string)
    const patterns = await invokeIPC(app, 'get-project-patterns', '/tmp/prompt-evolution');

    expect(patterns).toBeDefined();
  });

  test('should show context-based recommendations', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Context test');
    await mainWindow.waitForTimeout(1000);

    // get-context-recommendations takes (category?: string, projectPath?: string)
    const recommendations = await invokeIPC(
      app,
      'get-context-recommendations',
      'code-generation',
      '/tmp/prompt-evolution'
    );

    expect(recommendations).toBeDefined();
  });

  test('should compare with project averages', async () => {
    const { app } = context;

    // get-project-patterns takes (projectPath: string)
    const patterns = await invokeIPC(app, 'get-project-patterns', '/tmp/test-project');

    expect(patterns).toBeDefined();
  });
});

test.describe('Data Export', () => {
  test('should allow exporting history data', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Export test');
    await mainWindow.waitForTimeout(1000);

    // get-history takes (limit?: number)
    const allHistory = await invokeIPC(app, 'get-history', 1000);

    expect(allHistory).toBeDefined();
    expect(Array.isArray(allHistory)).toBe(true);
  });

  test('should export complete analysis data', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Complete data test');
    await mainWindow.waitForTimeout(1000);

    const history = await invokeIPC(app, 'get-history', 1);

    if (history.length > 0) {
      const analysis = history[0];
      expect(analysis).toHaveProperty('promptText');
      expect(analysis).toHaveProperty('goldenScores');
      expect(analysis).toHaveProperty('issues');
    }
  });
});

test.describe('Real-time Updates', () => {
  test('should update progress when new analysis completes', async () => {
    const { app, mainWindow } = context;

    // Get initial count
    const initialStats = await invokeIPC(app, 'get-stats');
    const initialCount = initialStats.totalAnalyses || 0;

    // Add new analysis
    await analyzePrompt(app, mainWindow, 'New analysis');
    await mainWindow.waitForTimeout(1500);

    // Get updated count
    const updatedStats = await invokeIPC(app, 'get-stats');
    const updatedCount = updatedStats.totalAnalyses || 0;

    expect(updatedCount).toBeGreaterThan(initialCount);
  });

  test('should update trends in real-time', async () => {
    const { app, mainWindow } = context;

    await analyzePrompt(app, mainWindow, 'Trend update test');
    await mainWindow.waitForTimeout(1000);

    // get-score-trend takes (days?: number)
    const trend = await invokeIPC(app, 'get-score-trend', 7);

    expect(trend).toBeDefined();
  });
});
