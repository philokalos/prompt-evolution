/**
 * Generate high-quality tray icons for macOS
 *
 * Creates template images (black with alpha) that adapt to light/dark mode
 * Design: Speech bubble with checkmark - represents prompt quality validation
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../assets/icons');

/**
 * Create a "P" letter icon as SVG for PromptLint
 * Simple, recognizable design that works well at small sizes
 *
 * For macOS template images: black shapes with transparency
 */
function createPromptCheckSVG(size: number): string {
  // Simple "P" letter design - clear and recognizable
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 2 L4 14 L6.5 14 L6.5 10 L9 10 C11.5 10 13 8.5 13 6 C13 3.5 11.5 2 9 2 Z M6.5 4 L8.5 4 C10 4 10.5 4.8 10.5 6 C10.5 7.2 10 8 8.5 8 L6.5 8 Z" fill="black"/>
</svg>`;
}

async function generateTrayIcons(): Promise<void> {
  console.log('🎨 Generating high-quality tray icons...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate 1x (16x16) template icon
  const svg16 = createPromptCheckSVG(16);
  await sharp(Buffer.from(svg16))
    .resize(16, 16)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'trayTemplate.png'));
  console.log('✅ Generated trayTemplate.png (16x16)');

  // Generate 2x (32x32) template icon for Retina displays
  const svg32 = createPromptCheckSVG(32);
  await sharp(Buffer.from(svg32))
    .resize(32, 32)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'trayTemplate@2x.png'));
  console.log('✅ Generated trayTemplate@2x.png (32x32)');

  // Also generate non-template versions for Windows/Linux
  const svg16Color = createPromptCheckSVG(16);
  await sharp(Buffer.from(svg16Color))
    .resize(16, 16)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'tray.png'));
  console.log('✅ Generated tray.png (16x16)');

  const svg32Color = createPromptCheckSVG(32);
  await sharp(Buffer.from(svg32Color))
    .resize(32, 32)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'tray@2x.png'));
  console.log('✅ Generated tray@2x.png (32x32)');

  console.log('\n✨ Tray icons generated successfully!');
  console.log('\n📋 Design:');
  console.log('   - Speech bubble (represents prompt/message)');
  console.log('   - Checkmark inside (represents quality validation)');
  console.log('   - Template image (auto-adapts to light/dark mode on macOS)');
  console.log('   - Optimized for menu bar display (16x16, 32x32@2x)');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTrayIcons().catch(console.error);
}

export { generateTrayIcons };
