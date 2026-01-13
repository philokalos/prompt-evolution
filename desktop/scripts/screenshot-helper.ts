#!/usr/bin/env node
/**
 * Screenshot Helper - Run alongside dev:electron
 *
 * Terminal 1:
 *   npm run dev:electron
 *
 * Terminal 2:
 *   npx tsx scripts/screenshot-helper.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;

// macOS screenshot utility
async function captureWindow(filename: string): Promise<void> {
  const filepath = path.join(SCREENSHOT_DIR, `temp-${filename}.png`);

  try {
    // Use macOS screencapture to capture focused window
    execSync(`screencapture -W "${filepath}"`, {
      stdio: 'ignore',
      timeout: 5000
    });

    console.log(`✅ Captured: ${filename}`);

    // Resize to 2880×1800
    if (fs.existsSync(filepath)) {
      const finalPath = path.join(SCREENSHOT_DIR, `${filename}.png`);
      await sharp(filepath)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255 },
        })
        .png()
        .toFile(finalPath);

      fs.unlinkSync(filepath); // Clean up temp
      console.log(`✅ Resized to ${TARGET_WIDTH}×${TARGET_HEIGHT}: ${filename}.png\n`);
    }
  } catch (error) {
    console.error(`❌ Failed to capture ${filename}:`, error);
  }
}

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('📸 App Store Screenshot Helper');
  console.log('================================\n');
  console.log('Instructions:');
  console.log('1. Make sure npm run dev:electron is running in another terminal');
  console.log('2. Position the PromptLint window in focus');
  console.log('3. This script will capture screenshots automatically\n');
  console.log('Press Enter to start (5 second delays between captures)...');

  // Wait for user input
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  console.log('\n🎬 Starting screenshot capture sequence...\n');

  const screenshots = [
    { name: '1-analysis-golden-radar', instruction: 'Show GOLDEN Radar & Issues view' },
    { name: '2-prompt-variants', instruction: 'Scroll to show 3 prompt variants' },
    { name: '3-progress-tracker', instruction: 'Click "Progress" to show history trends' },
    { name: '4-personal-tips', instruction: 'Show personal learning tips' },
    { name: '5-settings', instruction: 'Open Settings panel' },
  ];

  for (const screenshot of screenshots) {
    console.log(`📸 Screenshot: ${screenshot.name}`);
    console.log(`   👉 ${screenshot.instruction}`);
    console.log('   Press Enter when ready to capture...');

    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });

    await captureWindow(screenshot.name);

    // Wait 5 seconds before next instruction
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log('\n✅ Screenshot capture complete!');
  console.log(`📁 Location: ${SCREENSHOT_DIR}`);
  console.log('\n✨ All screenshots are 2880×1800 (App Store format)');
  console.log('\n📋 Next steps:');
  console.log('1. Review screenshots in ' + SCREENSHOT_DIR);
  console.log('2. Upload to App Store Connect → App Information → Screenshots');
  console.log('3. Set correct language (한국어)');

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
