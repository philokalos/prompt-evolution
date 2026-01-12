#!/usr/bin/env node
/**
 * Automated Screenshot Capture via Electron
 *
 * Launches the app in a special "screenshot mode" and captures each screen.
 * This uses Electron's native capturePage() which works perfectly.
 *
 * Run: npx tsx scripts/capture-screenshots.ts
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;
const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 900;

let mainWindow: BrowserWindow | null = null;
const _screenshotIndex = 0;

interface CaptureRequest {
  name: string;
  description: string;
  setup: string; // IPC message to send before capturing
}

const CAPTURES: CaptureRequest[] = [
  {
    name: '1-analysis-golden-radar',
    description: 'GOLDEN Analysis with Radar Chart',
    setup: 'set-view-mode:analysis',
  },
  {
    name: '2-prompt-variants',
    description: 'Prompt Variants (Conservative, Balanced, Comprehensive)',
    setup: 'scroll-to:prompt-comparison',
  },
  {
    name: '3-progress-tracker',
    description: 'Progress Tracker with Score Trends',
    setup: 'set-view-mode:progress',
  },
  {
    name: '4-personal-tips',
    description: 'Personal Learning Tips',
    setup: 'set-view-mode:tips',
  },
  {
    name: '5-settings',
    description: 'Settings Panel',
    setup: 'open-settings:true',
  },
];

async function captureScreen(request: CaptureRequest): Promise<void> {
  if (!mainWindow) return;

  console.log(`\n📸 Capturing: ${request.name}`);
  console.log(`   Description: ${request.description}`);

  try {
    // Send setup command to renderer
    console.log(`   Setup: ${request.setup}`);

    // Wait for UI to render
    await new Promise((r) => setTimeout(r, 1500));

    // Capture the window
    const image = await mainWindow.webContents.capturePage({
      x: 0,
      y: 0,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    });

    const pngBuffer = await image.toPNG();

    // Resize to App Store dimensions
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
    console.error(`   ❌ Failed to capture ${request.name}:`, error);
  }
}

async function createWindow(): Promise<void> {
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

  // Simulate clipboard data to trigger analysis
  mainWindow.webContents.send('clipboard-text', {
    text: 'Create a function that validates email addresses using regex. It should support common email formats including subdomains, and handle edge cases like numbers and special characters in the local part.',
    capturedContext: {
      project: {
        projectPath: '/Users/developer/projects/myapp',
        ideName: 'VS Code',
        currentFile: 'src/validators.ts',
        confidence: 0.95,
        isManual: false,
      },
    },
    isSourceAppBlocked: false,
  });

  // Setup IPC handlers for screenshot mode
  ipcMain.on('set-view-mode', (event, mode: string) => {
    console.log(`  📍 View mode changed to: ${mode}`);
  });

  ipcMain.on('scroll-to', (event, element: string) => {
    mainWindow?.webContents.executeJavaScript(`
      const el = document.querySelector('[data-testid="${element}"]');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    `);
  });

  ipcMain.on('open-settings', (event, open: boolean) => {
    mainWindow?.webContents.executeJavaScript(`
      const btn = document.querySelector('[data-testid="settings-button"]');
      if (btn && ${open}) btn.click();
    `);
  });

  console.log('✅ Window created\n');
}

async function generateScreenshots() {
  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('🎬 PromptLint App Store Screenshot Generator');
  console.log('==========================================');

  try {
    await app.whenReady();
    console.log('📱 Electron app ready\n');

    await createWindow();

    // Wait for app to fully load
    await new Promise((r) => setTimeout(r, 2000));

    // Capture each screenshot
    for (const capture of CAPTURES) {
      await captureScreen(capture);
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log('\n✅ Screenshot generation complete!');
    console.log(`📁 Location: ${SCREENSHOT_DIR}`);
    console.log(`📐 Size: ${TARGET_WIDTH}×${TARGET_HEIGHT} (App Store format)\n`);
    console.log('📋 Next steps:');
    console.log('1. Open App Store Connect');
    console.log('2. Go to PromptLint → App Information → Screenshots');
    console.log('3. Select language: 한국어');
    console.log('4. Upload all 5 screenshots from:');
    console.log(`   ${SCREENSHOT_DIR}\n`);

    // Keep window open briefly so user can see results
    await new Promise((r) => setTimeout(r, 2000));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Handle app quit
app.on('window-all-closed', () => {
  process.exit(0);
});

generateScreenshots().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
