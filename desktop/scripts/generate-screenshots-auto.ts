#!/usr/bin/env node
/**
 * Fully Automated Screenshot Generation
 *
 * Prerequisites:
 *   npm install -D playwright
 *
 * Run:
 *   npx tsx scripts/generate-screenshots-auto.ts
 *
 * Requirements:
 *   - Vite dev server should be running or will be started automatically
 *   - Generates 2880×1800 App Store screenshots
 */

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import sharp from 'sharp';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;
const CAPTURE_WIDTH = 1440;
const CAPTURE_HEIGHT = 900;

interface MockAnalysis {
  overallScore: number;
  grade: string;
  goldenScores: Record<string, number>;
  issues: Array<{ severity: string; message: string; suggestion: string }>;
  personalTips: string[];
  promptVariants: Array<{ variant: string; confidence: number; type: string }>;
}

const mockAnalysis: MockAnalysis = {
  overallScore: 0.78,
  grade: 'B+',
  goldenScores: {
    goal: 0.85,
    output: 0.72,
    limits: 0.68,
    data: 0.80,
    evaluation: 0.75,
    next: 0.82,
  },
  issues: [
    {
      severity: 'high',
      message: '목표가 명확하지 않습니다',
      suggestion: '원하는 결과의 구체적인 예시를 추가하세요',
    },
    {
      severity: 'medium',
      message: '순서가 논리적이지 않습니다',
      suggestion: '단계별 요구사항을 명확히 구분하세요',
    },
    {
      severity: 'low',
      message: '표현이 다소 모호합니다',
      suggestion: '더 구체적인 용어를 사용하세요',
    },
  ],
  personalTips: [
    '최근 프롬프트에서 "제한사항" 차원이 약한 경향이 있습니다',
    '이 프로젝트에서는 보통 구조화된 출력 형식을 선호합니다',
    '평가 기준을 명시하면 85% 이상 점수 개선 효과가 있습니다',
  ],
  promptVariants: [
    {
      variant:
        'Conservative: Minimal changes, focus on clarity\n\nYou are a helpful assistant...',
      confidence: 0.92,
      type: 'conservative',
    },
    {
      variant:
        'Balanced: Full GOLDEN structure with examples\n\nYour role: Code assistant...',
      confidence: 0.88,
      type: 'balanced',
    },
    {
      variant:
        'Comprehensive: Detailed context + evaluation criteria\n\nYou are an expert...',
      confidence: 0.85,
      type: 'comprehensive',
    },
  ],
};

async function resizeScreenshot(inputPath: string, outputPath: string): Promise<void> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Screenshot not found: ${inputPath}`);
  }

  await sharp(inputPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(outputPath);

  // Clean up original
  fs.unlinkSync(inputPath);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateScreenshots() {
  console.log('🎬 PromptLint App Store Screenshot Generator');
  console.log('==========================================\n');

  // Ensure directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  try {
    // Check if Playwright is installed
    console.log('📦 Checking dependencies...');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('playwright');
    } catch {
      console.log(
        '⚠️  Playwright not found. Installing...\n'
      );
      childProcess.execSync('npm install -D playwright', { stdio: 'inherit' });
    }

    const { chromium } = await import('playwright');

    console.log('🌐 Starting browser...');
    const browser = await chromium.launch({ headless: true });

    const page = await browser.newPage({
      viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      deviceScaleFactor: 2,
    });

    // Inject CSS to hide UI elements if needed
    await page.addInitScript(() => {
      // Make app taller to show more content
      const root = document.getElementById('root');
      if (root) {
        root.style.minHeight = '100vh';
      }
    });

    const devUrl = 'http://localhost:5173';
    console.log(`🔗 Connecting to ${devUrl}...`);

    try {
      await page.goto(devUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (_error) {
      console.error('❌ Failed to connect to dev server.');
      console.error('   Make sure Vite is running: npm run dev');
      process.exit(1);
    }

    console.log('✅ Connected to dev server\n');

    // Wait for app to be ready
    await page.waitForSelector('body', { timeout: 10000 });
    await delay(2000);

    // Screenshot 1: Inject mock analysis and capture
    console.log('📸 Screenshot 1: Analysis View (GOLDEN Radar)');
    await page.evaluate((data) => {
      // Simulate IPC by triggering analysis
      const event = new CustomEvent('clipboard-text', { detail: data });
      window.dispatchEvent(event);
    }, mockAnalysis);
    await delay(2000);

    let screenshotPath = path.join(SCREENSHOT_DIR, 'temp-1.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await resizeScreenshot(
      screenshotPath,
      path.join(SCREENSHOT_DIR, '1-analysis-golden-radar.png')
    );
    console.log('   ✅ Saved: 1-analysis-golden-radar.png\n');

    // Screenshot 2: Scroll to variants
    console.log('📸 Screenshot 2: Prompt Variants');
    await page.evaluate(() => {
      const elem = document.querySelector('[data-testid="prompt-comparison"]');
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    });
    await delay(1500);

    screenshotPath = path.join(SCREENSHOT_DIR, 'temp-2.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await resizeScreenshot(
      screenshotPath,
      path.join(SCREENSHOT_DIR, '2-prompt-variants.png')
    );
    console.log('   ✅ Saved: 2-prompt-variants.png\n');

    // Screenshot 3: Progress view
    console.log('📸 Screenshot 3: Progress Tracker');
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="tab-progress"]') as HTMLElement;
      if (button) button.click();
    });
    await delay(1500);

    screenshotPath = path.join(SCREENSHOT_DIR, 'temp-3.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await resizeScreenshot(
      screenshotPath,
      path.join(SCREENSHOT_DIR, '3-progress-tracker.png')
    );
    console.log('   ✅ Saved: 3-progress-tracker.png\n');

    // Screenshot 4: Tips view
    console.log('📸 Screenshot 4: Personal Tips');
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="tab-tips"]') as HTMLElement;
      if (button) button.click();
    });
    await delay(1500);

    screenshotPath = path.join(SCREENSHOT_DIR, 'temp-4.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await resizeScreenshot(
      screenshotPath,
      path.join(SCREENSHOT_DIR, '4-personal-tips.png')
    );
    console.log('   ✅ Saved: 4-personal-tips.png\n');

    // Screenshot 5: Settings
    console.log('📸 Screenshot 5: Settings');
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="settings-button"]') as HTMLElement;
      if (button) button.click();
    });
    await delay(1500);

    screenshotPath = path.join(SCREENSHOT_DIR, 'temp-5.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await resizeScreenshot(
      screenshotPath,
      path.join(SCREENSHOT_DIR, '5-settings.png')
    );
    console.log('   ✅ Saved: 5-settings.png\n');

    // Cleanup
    await browser.close();

    console.log('✅ Screenshot generation complete!');
    console.log(`📁 Location: ${SCREENSHOT_DIR}`);
    console.log(`📐 Size: ${TARGET_WIDTH}×${TARGET_HEIGHT} (App Store format)\n`);
    console.log('📋 Next steps:');
    console.log('1. Review screenshots in ' + SCREENSHOT_DIR);
    console.log('2. App Store Connect → App Information → Screenshots');
    console.log('3. Language: 한국어');
    console.log('4. Upload all 5 screenshots\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateScreenshots();
