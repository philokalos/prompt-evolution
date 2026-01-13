#!/usr/bin/env node
/**
 * Generate App Store screenshots automatically
 * Requirements: 2880×1800 (15" MacBook Pro)
 *
 * Usage:
 *   npx tsx scripts/generate-app-screenshots.ts
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const WINDOW_WIDTH = 1440;  // Will scale 2x for retina
const WINDOW_HEIGHT = 900;
const TARGET_WIDTH = 2880;
const TARGET_HEIGHT = 1800;

interface MockAnalysisResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    suggestion: string;
  }>;
  personalTips: string[];
  promptVariants: Array<{
    variant: string;
    confidence: number;
    type: 'conservative' | 'balanced' | 'comprehensive' | 'ai';
  }>;
  historyRecommendations?: Array<{
    type: string;
    message: string;
  }>;
}

// Mock analysis results for different scenarios
const MOCK_DATA: Record<string, MockAnalysisResult> = {
  analysis: {
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
        category: 'clarity',
        message: '목표가 명확하지 않습니다',
        suggestion: '원하는 결과의 구체적인 예시를 추가하세요',
      },
      {
        severity: 'medium',
        category: 'structure',
        message: '순서가 논리적이지 않습니다',
        suggestion: '단계별 요구사항을 명확히 구분하세요',
      },
      {
        severity: 'low',
        category: 'style',
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
        variant: 'Conservative: Minimal changes, focus on clarity\n\nYou are a helpful assistant...',
        confidence: 0.92,
        type: 'conservative',
      },
      {
        variant: 'Balanced: Full GOLDEN structure with examples\n\nYour role: Code assistant...',
        confidence: 0.88,
        type: 'balanced',
      },
      {
        variant: 'Comprehensive: Detailed context + evaluation criteria\n\nYou are an expert...',
        confidence: 0.85,
        type: 'comprehensive',
      },
    ],
    historyRecommendations: [
      {
        type: 'improvement',
        message: '이전 프롬프트보다 12% 높은 점수입니다',
      },
      {
        type: 'pattern',
        message: '최근 3개월간 "데이터" 차원 점수가 꾸준히 개선되었습니다',
      },
    ],
  },
  progress: {
    overallScore: 0.75,
    grade: 'B',
    goldenScores: {
      goal: 0.80,
      output: 0.70,
      limits: 0.65,
      data: 0.78,
      evaluation: 0.73,
      next: 0.80,
    },
    issues: [],
    personalTips: [],
    promptVariants: [],
  },
};

let window: BrowserWindow | null = null;
let screenshotIndex = 0;

async function createWindow() {
  window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, '../dist/preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  const rendererPath = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/renderer/index.html')}`;

  await window.loadURL(rendererPath);
  window.webContents.openDevTools({ mode: 'detach' });

  return new Promise<void>((resolve) => {
    window!.webContents.once('did-finish-load', () => {
      console.log('✅ Renderer loaded');
      resolve();
    });
  });
}

async function captureScreenshot(name: string): Promise<void> {
  if (!window) return;

  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const image = await window!.webContents.capturePage();
        const pngBuffer = await image.toPNG();

        // Resize to App Store dimensions
        const resized = await sharp(pngBuffer)
          .resize(TARGET_WIDTH, TARGET_HEIGHT, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255 },
          })
          .png()
          .toBuffer();

        const filename = `${++screenshotIndex}-${name}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        fs.writeFileSync(filepath, resized);

        console.log(`✅ Screenshot saved: ${filename}`);
        resolve();
      } catch (error) {
        console.error(`❌ Failed to capture screenshot ${name}:`, error);
        resolve();
      }
    }, 500);
  });
}

async function sendMockData(data: MockAnalysisResult): Promise<void> {
  if (!window) return;

  return new Promise((resolve) => {
    window!.webContents.send('clipboard-text', {
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

    setTimeout(() => {
      // Wait for analysis to complete then send mock result via IPC
      window!.webContents.send('mock-analysis-complete', data);
      resolve();
    }, 1000);
  });
}

async function generateScreenshots() {
  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('🎬 Starting App Store screenshot generation...\n');

  try {
    // App startup
    await app.whenReady();
    console.log('📱 Electron app ready\n');

    // Create window
    await createWindow();
    console.log('🪟 Window created\n');

    // Setup IPC for mock data
    ipcMain.on('get-mock-analysis', (event) => {
      console.log('🔄 Renderer requesting mock analysis...');
      event.reply('mock-analysis', MOCK_DATA.analysis);
    });

    // Screenshot 1: Main Analysis View
    console.log('📸 Screenshot 1: Analysis View (GOLDEN Radar + Issues)');
    await sendMockData(MOCK_DATA.analysis);
    await new Promise((r) => setTimeout(r, 2000)); // Wait for UI to render
    await captureScreenshot('analysis-golden-radar');

    // Screenshot 2: Prompt Variants
    console.log('📸 Screenshot 2: Prompt Variants (3 suggestions)');
    // Simulate scrolling to variants section
    await window?.webContents.executeJavaScript(
      'document.querySelector("[data-testid=prompt-comparison]")?.scrollIntoView()'
    );
    await new Promise((r) => setTimeout(r, 1000));
    await captureScreenshot('prompt-variants');

    // Screenshot 3: History & Trends
    console.log('📸 Screenshot 3: Progress Tracker (History & Trends)');
    await window?.webContents.executeJavaScript(
      'window.electronAPI.onNavigate("progress")'
    );
    await new Promise((r) => setTimeout(r, 1500));
    await captureScreenshot('progress-tracker');

    // Screenshot 4: Personal Tips
    console.log('📸 Screenshot 4: Personal Learning Tips');
    await window?.webContents.executeJavaScript(
      'window.electronAPI.onNavigate("tips")'
    );
    await new Promise((r) => setTimeout(r, 1500));
    await captureScreenshot('personal-tips');

    // Screenshot 5: Settings
    console.log('📸 Screenshot 5: Settings & Configuration');
    await window?.webContents.executeJavaScript(
      'document.querySelector("[data-testid=settings-button]")?.click()'
    );
    await new Promise((r) => setTimeout(r, 1500));
    await captureScreenshot('settings');

    console.log('\n✅ All screenshots generated successfully!');
    console.log(`📁 Location: ${SCREENSHOT_DIR}`);
    console.log('\n📋 Next steps:');
    console.log('1. Review screenshots in ' + SCREENSHOT_DIR);
    console.log('2. Upload to App Store Connect');
    console.log('3. Ensure all 5 screenshots are 2880×1800');

    process.exit(0);
  } catch (error) {
    console.error('❌ Screenshot generation failed:', error);
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
