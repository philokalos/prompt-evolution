/**
 * Icon Generation Script for PromptLint
 * Generates all required icon sizes from the source SVG
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '../assets/icons');
const svgPath = path.join(iconsDir, 'icon.svg');

// Icon sizes needed
const sizes = {
  // macOS iconset sizes
  icns: [16, 32, 64, 128, 256, 512, 1024],
  // Tray icons
  tray: [16, 32], // 16 for 1x, 32 for 2x
  // Windows .ico sizes
  ico: [16, 24, 32, 48, 64, 128, 256],
};

async function generatePng(inputPath: string, outputPath: string, size: number): Promise<void> {
  await sharp(inputPath)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`  Generated: ${path.basename(outputPath)}`);
}

async function generateMacIconset(): Promise<void> {
  console.log('\n📦 Generating macOS iconset...');

  const iconsetDir = path.join(iconsDir, 'icon.iconset');

  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  // Generate all required sizes for macOS iconset
  const iconsetSizes = [
    { size: 16, suffix: '16x16' },
    { size: 32, suffix: '16x16@2x' },
    { size: 32, suffix: '32x32' },
    { size: 64, suffix: '32x32@2x' },
    { size: 128, suffix: '128x128' },
    { size: 256, suffix: '128x128@2x' },
    { size: 256, suffix: '256x256' },
    { size: 512, suffix: '256x256@2x' },
    { size: 512, suffix: '512x512' },
    { size: 1024, suffix: '512x512@2x' },
  ];

  for (const { size, suffix } of iconsetSizes) {
    const outputPath = path.join(iconsetDir, `icon_${suffix}.png`);
    await generatePng(svgPath, outputPath, size);
  }

  // Convert iconset to icns using iconutil
  console.log('  Converting to .icns...');
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(iconsDir, 'icon.icns')}"`, {
      stdio: 'pipe',
    });
    console.log('  ✅ Created icon.icns');
  } catch (error) {
    console.error('  ❌ Failed to create .icns file:', error);
  }

  // Clean up iconset directory
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

async function generateTrayIcons(): Promise<void> {
  console.log('\n🔲 Generating tray icons...');

  // For macOS, tray icons should be template images (grayscale)
  // We'll create both color and template versions

  // Regular tray icon
  await generatePng(svgPath, path.join(iconsDir, 'tray.png'), 16);
  await generatePng(svgPath, path.join(iconsDir, 'tray@2x.png'), 32);

  // Template icons (macOS will colorize these automatically)
  // For template, we create a grayscale version
  const trayTemplatePath = path.join(iconsDir, 'trayTemplate.png');
  const trayTemplate2xPath = path.join(iconsDir, 'trayTemplate@2x.png');

  await sharp(svgPath)
    .resize(16, 16)
    .grayscale()
    .png()
    .toFile(trayTemplatePath);
  console.log('  Generated: trayTemplate.png');

  await sharp(svgPath)
    .resize(32, 32)
    .grayscale()
    .png()
    .toFile(trayTemplate2xPath);
  console.log('  Generated: trayTemplate@2x.png');
}

async function generateWindowsIco(): Promise<void> {
  console.log('\n🪟 Generating Windows .ico...');

  // Generate PNG files for each size
  const pngDir = path.join(iconsDir, 'ico-temp');
  if (!fs.existsSync(pngDir)) {
    fs.mkdirSync(pngDir, { recursive: true });
  }

  const pngFiles: string[] = [];
  for (const size of sizes.ico) {
    const pngPath = path.join(pngDir, `icon-${size}.png`);
    await generatePng(svgPath, pngPath, size);
    pngFiles.push(pngPath);
  }

  // For ICO generation, we'll use sharp to create a composite
  // Actually, sharp doesn't directly support ICO output
  // We'll create individual PNGs and note that ico conversion needs additional tool

  // Keep the 256x256 PNG as the main icon for electron-builder
  await generatePng(svgPath, path.join(iconsDir, 'icon.png'), 256);
  console.log('  Generated: icon.png (256x256)');

  // Clean up temp directory
  fs.rmSync(pngDir, { recursive: true, force: true });

  // Note about ICO generation
  console.log('  ⚠️  For Windows .ico, use an online converter or png2ico tool');
  console.log('     Input: icon.png (256x256)');
}

async function generateLinuxIcons(): Promise<void> {
  console.log('\n🐧 Generating Linux icons...');

  const linuxSizes = [16, 32, 48, 64, 128, 256, 512];

  for (const size of linuxSizes) {
    const outputPath = path.join(iconsDir, `${size}x${size}.png`);
    await generatePng(svgPath, outputPath, size);
  }
}

async function main(): Promise<void> {
  console.log('🎨 PromptLint Icon Generator');
  console.log('============================');

  // Check if SVG exists
  if (!fs.existsSync(svgPath)) {
    console.error('❌ Source SVG not found:', svgPath);
    process.exit(1);
  }

  try {
    await generateMacIconset();
    await generateTrayIcons();
    await generateWindowsIco();
    await generateLinuxIcons();

    console.log('\n✅ Icon generation complete!');
    console.log('\nGenerated files:');
    const files = fs.readdirSync(iconsDir).filter(f => !f.endsWith('.svg'));
    files.forEach(f => console.log(`  - ${f}`));
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

main();
