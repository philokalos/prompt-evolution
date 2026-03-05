#!/usr/bin/env npx tsx
/**
 * App Store Screenshot Capture (Coaching UX)
 *
 * Uses Playwright + Electron to capture real UI screenshots.
 * Requires: npm run build:all (already built)
 *
 * Run: npx tsx scripts/capture-appstore-screenshots.ts
 */

import { _electron as electron } from 'playwright';
import { join } from 'path';
import { mkdtempSync, rmSync, mkdirSync, existsSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import sharp from 'sharp';

const SCREENSHOT_DIR = join(process.cwd(), 'screenshots');
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;

const SAMPLE_PROMPT = `현재 상황을 분석해줘. 코드를 리팩토링하고 싶은데 어떻게 하면 좋을까? 버그도 있는 것 같고, 테스트도 추가해야 할 것 같아. 전체적으로 개선할 부분을 알려줘.`;

async function resizeTo2x(inputPath: string): Promise<void> {
  const tmpPath = inputPath + '.tmp';
  await sharp(inputPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'contain',
      background: { r: 26, g: 27, b: 38, alpha: 1 },
    })
    .png()
    .toFile(tmpPath);
  renameSync(tmpPath, inputPath);
}

async function main() {
  console.log('App Store Screenshot Capture');
  console.log('============================\n');

  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const mainPath = join(process.cwd(), 'dist', 'main', 'index.js');
  const testDbDir = mkdtempSync(join(tmpdir(), 'promptlint-screenshots-'));

  console.log('Launching Electron app...');
  const app = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PROMPTLINT_DB_DIR: testDbDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  const mainWindow = await app.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded');
  await mainWindow.waitForTimeout(2000);
  console.log('App ready.\n');

  // --- Screenshot 1: Direct Input (empty state) ---
  console.log('[1/5] Direct Input (empty state)');
  const directInputBtn = mainWindow.locator('button:has-text("직접 입력"), button:has-text("Direct Input"), button:has-text("직접 입력하기")');
  if (await directInputBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await directInputBtn.click();
    await mainWindow.waitForTimeout(500);
  }
  await mainWindow.screenshot({ path: join(SCREENSHOT_DIR, '1-direct-input.png') });
  await resizeTo2x(join(SCREENSHOT_DIR, '1-direct-input.png'));
  console.log('  Saved.\n');

  // --- Trigger analysis ---
  console.log('Sending prompt for analysis...');
  await app.evaluate(
    ({ BrowserWindow }, payload) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('clipboard-text', payload);
      }
    },
    {
      text: SAMPLE_PROMPT,
      capturedContext: null,
      isSourceAppBlocked: false,
      sourceApp: 'test',
    }
  );

  await mainWindow.waitForSelector('.grade-badge', { timeout: 15000 });
  await mainWindow.waitForTimeout(1000);
  console.log('Analysis complete.\n');

  // --- Screenshot 2: Coaching Analysis (TopFixCard + GoldenMiniBar) ---
  console.log('[2/5] Coaching Analysis (main view)');
  await mainWindow.evaluate(() => {
    document.querySelector('.overflow-y-auto')?.scrollTo(0, 0);
  });
  await mainWindow.waitForTimeout(500);
  await mainWindow.screenshot({ path: join(SCREENSHOT_DIR, '2-coaching-analysis.png') });
  await resizeTo2x(join(SCREENSHOT_DIR, '2-coaching-analysis.png'));
  console.log('  Saved.\n');

  // --- Screenshot 3: Suggested Rewrite (expand collapsible) ---
  console.log('[3/5] Suggested Rewrite');
  const rewriteBtn = mainWindow.locator('button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")');
  if (await rewriteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rewriteBtn.click();
    await mainWindow.waitForTimeout(800);
  }
  await mainWindow.screenshot({ path: join(SCREENSHOT_DIR, '3-suggested-rewrite.png') });
  await resizeTo2x(join(SCREENSHOT_DIR, '3-suggested-rewrite.png'));
  console.log('  Saved.\n');

  // --- Screenshot 4: Progress Tracker ---
  console.log('[4/5] Progress Tracker');
  const progressBtn = mainWindow.locator('button:has-text("내 진행 상황"), button:has-text("My Progress")');
  if (await progressBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await progressBtn.click();
    await mainWindow.waitForTimeout(1000);
  }
  await mainWindow.screenshot({ path: join(SCREENSHOT_DIR, '4-progress-stats.png') });
  await resizeTo2x(join(SCREENSHOT_DIR, '4-progress-stats.png'));
  console.log('  Saved.\n');

  // --- Screenshot 5: Settings ---
  console.log('[5/5] Settings');
  const backBtn = mainWindow.locator('button[aria-label*="뒤로"], button[aria-label*="back" i]');
  if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await backBtn.click();
    await mainWindow.waitForTimeout(500);
  }
  const settingsBtn = mainWindow.locator('button[aria-label*="설정"], button[aria-label*="Settings" i]');
  if (await settingsBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await settingsBtn.first().click();
    await mainWindow.waitForTimeout(800);
  }
  await mainWindow.screenshot({ path: join(SCREENSHOT_DIR, '5-settings.png') });
  await resizeTo2x(join(SCREENSHOT_DIR, '5-settings.png'));
  console.log('  Saved.\n');

  // Cleanup
  await app.close();
  try { rmSync(testDbDir, { recursive: true, force: true }); } catch { /* ignore */ }

  console.log('============================');
  console.log(`All screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log(`Size: ${TARGET_WIDTH}x${TARGET_HEIGHT} (App Store format)`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
