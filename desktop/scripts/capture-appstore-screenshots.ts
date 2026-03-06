#!/usr/bin/env npx tsx
/**
 * App Store Screenshot Capture (Coaching UX)
 *
 * Captures screenshots in both Korean and English for App Store Connect.
 * Requires: npm run build:all (already built)
 *
 * Run: npx tsx scripts/capture-appstore-screenshots.ts
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { join } from 'path';
import { mkdtempSync, rmSync, mkdirSync, existsSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import sharp from 'sharp';

const SCREENSHOT_DIR = join(process.cwd(), 'screenshots');
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;

const PROMPTS = {
  ko: '현재 상황을 분석해줘. 코드를 리팩토링하고 싶은데 어떻게 하면 좋을까? 버그도 있는 것 같고, 테스트도 추가해야 할 것 같아. 전체적으로 개선할 부분을 알려줘.',
  en: 'Analyze the current situation. I want to refactor the code but how should I approach it? There seem to be bugs too, and I think I need to add tests. Tell me what to improve overall.',
};

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

async function switchLanguage(app: ElectronApplication, mainWindow: Page, lang: string): Promise<void> {
  await mainWindow.evaluate(async (lng) => {
    await window.electronAPI.setLanguage(lng);
  }, lang);
  await mainWindow.waitForTimeout(1500);
}

async function captureSet(
  app: ElectronApplication,
  mainWindow: Page,
  lang: 'ko' | 'en',
  outDir: string,
): Promise<void> {
  const prefix = lang;

  // --- Screenshot 1: Direct Input (empty state) ---
  console.log(`  [1/5] Direct Input`);
  const directInputBtn = mainWindow.locator(
    'button:has-text("직접 입력"), button:has-text("Direct Input"), button:has-text("직접 입력하기")'
  );
  if (await directInputBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await directInputBtn.click();
    await mainWindow.waitForTimeout(500);
  }
  const p1 = join(outDir, `${prefix}-1-direct-input.png`);
  await mainWindow.screenshot({ path: p1 });
  await resizeTo2x(p1);

  // --- Trigger analysis ---
  console.log(`  Analyzing...`);
  await app.evaluate(
    ({ BrowserWindow }, payload) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('clipboard-text', payload);
      }
    },
    {
      text: PROMPTS[lang],
      capturedContext: null,
      isSourceAppBlocked: false,
      sourceApp: 'test',
    }
  );
  await mainWindow.waitForSelector('.grade-badge', { timeout: 15000 });
  await mainWindow.waitForTimeout(1000);

  // --- Screenshot 2: Coaching Analysis ---
  console.log(`  [2/5] Coaching Analysis`);
  await mainWindow.evaluate(() => {
    document.querySelector('.overflow-y-auto')?.scrollTo(0, 0);
  });
  await mainWindow.waitForTimeout(500);
  const p2 = join(outDir, `${prefix}-2-coaching-analysis.png`);
  await mainWindow.screenshot({ path: p2 });
  await resizeTo2x(p2);

  // --- Screenshot 3: Suggested Rewrite ---
  console.log(`  [3/5] Suggested Rewrite`);
  const rewriteBtn = mainWindow.locator(
    'button:has-text("추천 수정안"), button:has-text("Suggested Rewrite")'
  );
  if (await rewriteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rewriteBtn.click();
    await mainWindow.waitForTimeout(800);
  }
  const p3 = join(outDir, `${prefix}-3-suggested-rewrite.png`);
  await mainWindow.screenshot({ path: p3 });
  await resizeTo2x(p3);

  // --- Screenshot 4: Progress Tracker ---
  console.log(`  [4/5] Progress Tracker`);
  const progressBtn = mainWindow.locator(
    'button:has-text("내 진행 상황"), button:has-text("My Progress")'
  );
  if (await progressBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await progressBtn.click();
    await mainWindow.waitForTimeout(1000);
  }
  const p4 = join(outDir, `${prefix}-4-progress-stats.png`);
  await mainWindow.screenshot({ path: p4 });
  await resizeTo2x(p4);

  // --- Screenshot 5: Settings ---
  console.log(`  [5/5] Settings`);
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
  const p5 = join(outDir, `${prefix}-5-settings.png`);
  await mainWindow.screenshot({ path: p5 });
  await resizeTo2x(p5);

  // Close settings for next round
  const closeBtn = mainWindow.locator('button:has-text("닫기"), button:has-text("Close")');
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    await mainWindow.waitForTimeout(500);
  }
}

async function main() {
  console.log('App Store Screenshot Capture (ko + en)');
  console.log('=======================================\n');

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

  // --- Korean screenshots ---
  console.log('[KO] Capturing Korean screenshots...');
  await switchLanguage(app, mainWindow, 'ko');
  await captureSet(app, mainWindow, 'ko', SCREENSHOT_DIR);
  console.log('[KO] Done.\n');

  // Reset: go to analysis view + new analysis for English
  await mainWindow.evaluate(() => {
    document.querySelector('.overflow-y-auto')?.scrollTo(0, 0);
  });
  // Click new analysis button if visible
  const newBtn = mainWindow.locator('button[aria-label*="새 분석"], button[aria-label*="New"]');
  if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newBtn.click();
    await mainWindow.waitForTimeout(500);
  }

  // --- English screenshots ---
  console.log('[EN] Capturing English screenshots...');
  await switchLanguage(app, mainWindow, 'en');
  await mainWindow.waitForTimeout(1000);
  await captureSet(app, mainWindow, 'en', SCREENSHOT_DIR);
  console.log('[EN] Done.\n');

  // Cleanup
  await app.close();
  try { rmSync(testDbDir, { recursive: true, force: true }); } catch { /* ignore */ }

  console.log('=======================================');
  console.log(`All screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log(`Size: ${TARGET_WIDTH}x${TARGET_HEIGHT} (App Store format)`);
  console.log('\nFiles:');
  console.log('  ko-1..5: Korean screenshots');
  console.log('  en-1..5: English screenshots');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
