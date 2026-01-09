/**
 * Generate high-quality tray icons for macOS
 *
 * Creates template images (black with alpha) that adapt to light/dark mode
 * Design: Sparkle/star icon representing AI enhancement and quality improvement
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../assets/icons');

/**
 * Create a sparkle/enhancement icon as SVG
 * This represents prompt improvement and AI quality enhancement
 */
function createSparkleSVG(size: number): string {
  const center = size / 2;
  const mainRadius = size * 0.35; // Main sparkle size
  const smallRadius = size * 0.15; // Small accent sparkles

  // Main sparkle - 4-point star in center
  const mainPoints: [number, number][] = [
    [center, center - mainRadius], // Top
    [center + mainRadius * 0.3, center - mainRadius * 0.3], // Top-right inner
    [center + mainRadius, center], // Right
    [center + mainRadius * 0.3, center + mainRadius * 0.3], // Bottom-right inner
    [center, center + mainRadius], // Bottom
    [center - mainRadius * 0.3, center + mainRadius * 0.3], // Bottom-left inner
    [center - mainRadius, center], // Left
    [center - mainRadius * 0.3, center - mainRadius * 0.3], // Top-left inner
  ];

  const mainPath = `M ${mainPoints.map(p => p.join(',')).join(' L ')} Z`;

  // Small accent sparkle (top-right)
  const accent1X = center + mainRadius * 0.85;
  const accent1Y = center - mainRadius * 0.85;
  const accentPoints1: [number, number][] = [
    [accent1X, accent1Y - smallRadius],
    [accent1X + smallRadius * 0.25, accent1Y - smallRadius * 0.25],
    [accent1X + smallRadius, accent1Y],
    [accent1X + smallRadius * 0.25, accent1Y + smallRadius * 0.25],
    [accent1X, accent1Y + smallRadius],
    [accent1X - smallRadius * 0.25, accent1Y + smallRadius * 0.25],
    [accent1X - smallRadius, accent1Y],
    [accent1X - smallRadius * 0.25, accent1Y - smallRadius * 0.25],
  ];
  const accent1Path = `M ${accentPoints1.map(p => p.join(',')).join(' L ')} Z`;

  // Small accent sparkle (bottom-left)
  const accent2X = center - mainRadius * 0.75;
  const accent2Y = center + mainRadius * 0.75;
  const accentPoints2: [number, number][] = [
    [accent2X, accent2Y - smallRadius * 0.8],
    [accent2X + smallRadius * 0.2, accent2Y - smallRadius * 0.2],
    [accent2X + smallRadius * 0.8, accent2Y],
    [accent2X + smallRadius * 0.2, accent2Y + smallRadius * 0.2],
    [accent2X, accent2Y + smallRadius * 0.8],
    [accent2X - smallRadius * 0.2, accent2Y + smallRadius * 0.2],
    [accent2X - smallRadius * 0.8, accent2Y],
    [accent2X - smallRadius * 0.2, accent2Y - smallRadius * 0.2],
  ];
  const accent2Path = `M ${accentPoints2.map(p => p.join(',')).join(' L ')} Z`;

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <g fill="black">
        <!-- Main sparkle -->
        <path d="${mainPath}" opacity="1.0"/>
        <!-- Accent sparkles -->
        <path d="${accent1Path}" opacity="0.9"/>
        <path d="${accent2Path}" opacity="0.85"/>
      </g>
    </svg>
  `.trim();
}

async function generateTrayIcons(): Promise<void> {
  console.log('🎨 Generating high-quality tray icons...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate 1x (16x16) template icon
  const svg16 = createSparkleSVG(16);
  await sharp(Buffer.from(svg16))
    .resize(16, 16)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'trayTemplate.png'));
  console.log('✅ Generated trayTemplate.png (16x16)');

  // Generate 2x (32x32) template icon
  const svg32 = createSparkleSVG(32);
  await sharp(Buffer.from(svg32))
    .resize(32, 32)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'trayTemplate@2x.png'));
  console.log('✅ Generated trayTemplate@2x.png (32x32)');

  console.log('\n✨ Tray icons generated successfully!');
  console.log('\n📋 Design:');
  console.log('   - 4-point sparkle star (main element)');
  console.log('   - 2 accent sparkles (visual balance)');
  console.log('   - Template image (auto-adapts to light/dark mode)');
  console.log('   - Optimized for menu bar display');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTrayIcons().catch(console.error);
}

export { generateTrayIcons };
