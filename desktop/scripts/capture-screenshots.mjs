#!/usr/bin/env node
/**
 * Automated Screenshot Capture via Electron
 *
 * Run: node scripts/capture-screenshots.mjs
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;
const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 900;

let mainWindow = null;

const CAPTURES = [
  {
    name: '1-analysis-golden-radar',
    description: 'GOLDEN Analysis with Radar Chart',
    delay: 2000,
  },
  {
    name: '2-prompt-variants',
    description: 'Prompt Variants',
    delay: 1500,
  },
  {
    name: '3-progress-tracker',
    description: 'Progress Tracker',
    delay: 1500,
  },
  {
    name: '4-personal-tips',
    description: 'Personal Tips',
    delay: 1500,
  },
  {
    name: '5-settings',
    description: 'Settings',
    delay: 1500,
  },
];

async function captureScreen(request) {
  if (!mainWindow) return;

  console.log(`\n📸 Capturing: ${request.name}`);
  console.log(`   Description: ${request.description}`);

  try {
    await new Promise((r) => setTimeout(r, request.delay));

    const image = await mainWindow.webContents.capturePage({
      x: 0,
      y: 0,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    });

    const pngBuffer = await image.toPNG();

    const resized = await sharp(pngBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
      .png()
      .toBuffer();

    const filepath = path.join(SCREENSHOT_DIR, `${request.name}.png`);
    fs.writeFileSync(filepath, resized);

    console.log(`   ✅ Saved: ${request.name}.png (${TARGET_WIDTH}×${TARGET_HEIGHT})`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, '../dist/preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: true,
  });

  const htmlPath = path.join(__dirname, '../dist/renderer/index.html');
  await mainWindow.loadFile(htmlPath);

  // Inject mock analysis result
  await mainWindow.webContents.executeJavaScript(`
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mock-analysis', {
        detail: {
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
            { severity: 'high', message: '목표가 명확하지 않습니다' },
            { severity: 'medium', message: '순서가 논리적이지 않습니다' }
          ],
          promptVariants: [
            { variant: 'Conservative variant...', confidence: 0.92, type: 'conservative' },
            { variant: 'Balanced variant...', confidence: 0.88, type: 'balanced' },
            { variant: 'Comprehensive variant...', confidence: 0.85, type: 'comprehensive' }
          ]
        }
      }));
    }, 500);
  `);

  console.log('✅ Window created\n');
}

async function generateScreenshots() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('🎬 PromptLint App Store Screenshot Generator');
  console.log('==========================================');

  try {
    await app.whenReady();
    console.log('📱 Electron app ready\n');

    await createWindow();
    await new Promise((r) => setTimeout(r, 2000));

    // Capture 1: Analysis
    await captureScreen(CAPTURES[0]);

    // Capture 2: Scroll to variants
    await mainWindow.webContents.executeJavaScript(`
      const el = document.querySelector('[data-testid="prompt-comparison"]') ||
                 document.querySelector('section:has(> h3)');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    `);
    await captureScreen(CAPTURES[1]);

    // Capture 3: Progress tab
    await mainWindow.webContents.executeJavaScript(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Progress'));
      if (btn) btn.click();
    `);
    await captureScreen(CAPTURES[2]);

    // Capture 4: Tips tab
    await mainWindow.webContents.executeJavaScript(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Tips'));
      if (btn) btn.click();
    `);
    await captureScreen(CAPTURES[3]);

    // Capture 5: Settings
    await mainWindow.webContents.executeJavaScript(`
      const btn = document.querySelector('button[title*="Settings"]') ||
                  document.querySelector('button[aria-label*="Settings"]') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('⚙'));
      if (btn) btn.click();
    `);
    await captureScreen(CAPTURES[4]);

    console.log('\n✅ Screenshot generation complete!');
    console.log(`📁 Location: ${SCREENSHOT_DIR}`);
    console.log(`📐 Size: ${TARGET_WIDTH}×${TARGET_HEIGHT}\n`);

    await new Promise((r) => setTimeout(r, 1000));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

app.on('window-all-closed', () => {
  process.exit(0);
});

generateScreenshots();
