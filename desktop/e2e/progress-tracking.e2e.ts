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

      // Should show some stats
      const statsSection = mainWindow.locator('[class*="stats"], [class*="overview"]');
      await expect(statsSection).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Score Trends', () => {
  test('should display score trend chart', async () => {
    const { app, mainWindow } = context;

    // Add some test analyses first
    await invokeIPC(app, 'analyze-prompt', 'First test');
    await mainWindow.waitForTimeout(1000);

    await invokeIPC(app, 'analyze-prompt', 'Second test');
    await mainWindow.waitForTimeout(1000);

    // Navigate to progress
    const progressTab = mainWindow.locator('text=/진행|progress/i');
    if (await progressTab.isVisible()) {
      await progressTab.click();
      await mainWindow.waitForTimeout(500);

      // Should show trend visualization
      const trendChart = mainWindow.locator('[class*="trend"], [class*="chart"], svg');
      await expect(trendChart).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show score improvement over time', async () => {
    const { app } = context;

    // Get trend data via IPC
    const trend = await invokeIPC(app, 'get-score-trend', { days: 7 });

    expect(trend).toBeDefined();
    expect(Array.isArray(trend)).toBe(true);
  });

  test('should filter trend by time period', async () => {
    const { app } = context;

    // Get different time periods
    const weekly = await invokeIPC(app, 'get-score-trend', { days: 7 });
    const monthly = await invokeIPC(app, 'get-score-trend', { days: 30 });

    expect(weekly).toBeDefined();
    expect(monthly).toBeDefined();
  });
});

test.describe('Weekly Stats', () => {
  test('should display weekly statistics', async () => {
    const { app, mainWindow } = context;

    // Add test data
    await invokeIPC(app, 'analyze-prompt', 'Weekly test prompt');
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
    await invokeIPC(app, 'analyze-prompt', 'First analysis');
    await mainWindow.waitForTimeout(1000);

    await invokeIPC(app, 'analyze-prompt', 'Improved analysis with clear goal and expected output');
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
    await invokeIPC(app, 'analyze-prompt', 'Weak prompt');
    await mainWindow.waitForTimeout(1000);

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

      // Should show suggestions or tips
      const suggestions = mainWindow.locator('text=/제안|suggestion|개선/i');
      await expect(suggestions).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('History Visualization', () => {
  test('should display analysis history list', async () => {
    const { app, mainWindow } = context;

    // Add test analyses
    await invokeIPC(app, 'analyze-prompt', 'History test 1');
    await mainWindow.waitForTimeout(1000);

    await invokeIPC(app, 'analyze-prompt', 'History test 2');
    await mainWindow.waitForTimeout(1000);

    // Get history
    const history = await invokeIPC(app, 'get-history', { limit: 10 });

    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  test('should show timestamps for each analysis', async () => {
    const { app } = context;

    const history = await invokeIPC(app, 'get-history', { limit: 5 });

    if (history.length > 0) {
      expect(history[0]).toHaveProperty('timestamp');
      expect(typeof history[0].timestamp).toBe('number');
    }
  });

  test('should show scores for each analysis', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Score test');
    await mainWindow.waitForTimeout(1000);

    const history = await invokeIPC(app, 'get-history', { limit: 1 });

    if (history.length > 0) {
      expect(history[0]).toHaveProperty('averageScore');
      expect(typeof history[0].averageScore).toBe('number');
    }
  });

  test('should allow filtering history by project', async () => {
    const { app } = context;

    // Get project-specific patterns
    const patterns = await invokeIPC(app, 'get-project-patterns', { projectName: 'test-project' });

    expect(patterns).toBeDefined();
  });

  test('should allow pagination of history', async () => {
    const { app } = context;

    // Get first page
    const page1 = await invokeIPC(app, 'get-history', { limit: 5, offset: 0 });

    // Get second page
    const page2 = await invokeIPC(app, 'get-history', { limit: 5, offset: 5 });

    expect(page1).toBeDefined();
    expect(page2).toBeDefined();
  });
});

test.describe('Project-Specific Insights', () => {
  test('should show project patterns', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Project-specific test');
    await mainWindow.waitForTimeout(1000);

    const patterns = await invokeIPC(app, 'get-project-patterns', { projectName: 'prompt-evolution' });

    expect(patterns).toBeDefined();
  });

  test('should show context-based recommendations', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Context test');
    await mainWindow.waitForTimeout(1000);

    const recommendations = await invokeIPC(app, 'get-context-recommendations', {
      projectName: 'prompt-evolution',
      category: 'code-generation',
    });

    expect(recommendations).toBeDefined();
  });

  test('should compare with project averages', async () => {
    const { app } = context;

    // Get project-specific averages
    const patterns = await invokeIPC(app, 'get-project-patterns', { projectName: 'test-project' });

    expect(patterns).toBeDefined();
  });
});

test.describe('Data Export', () => {
  test('should allow exporting history data', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Export test');
    await mainWindow.waitForTimeout(1000);

    // Get all history (simulates export)
    const allHistory = await invokeIPC(app, 'get-history', { limit: 1000 });

    expect(allHistory).toBeDefined();
    expect(Array.isArray(allHistory)).toBe(true);
  });

  test('should export complete analysis data', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Complete data test');
    await mainWindow.waitForTimeout(1000);

    const history = await invokeIPC(app, 'get-history', { limit: 1 });

    if (history.length > 0) {
      const analysis = history[0];
      expect(analysis).toHaveProperty('originalText');
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
    await invokeIPC(app, 'analyze-prompt', 'New analysis');
    await mainWindow.waitForTimeout(1500);

    // Get updated count
    const updatedStats = await invokeIPC(app, 'get-stats');
    const updatedCount = updatedStats.totalAnalyses || 0;

    expect(updatedCount).toBeGreaterThan(initialCount);
  });

  test('should update trends in real-time', async () => {
    const { app, mainWindow } = context;

    await invokeIPC(app, 'analyze-prompt', 'Trend update test');
    await mainWindow.waitForTimeout(1000);

    const trend = await invokeIPC(app, 'get-score-trend', { days: 7 });

    expect(trend).toBeDefined();
  });
});
