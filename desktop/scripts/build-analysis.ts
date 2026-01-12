/**
 * Build analysis modules as a single CJS bundle for Electron
 * This avoids ESM/CJS compatibility issues in packaged Electron apps
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopRoot = path.join(__dirname, '..');
const parentRoot = path.join(desktopRoot, '..');
const analysisDir = path.join(parentRoot, 'src/analysis');
const outDir = path.join(desktopRoot, 'dist/analysis');

async function build() {
  console.log('[build-analysis] Starting CJS bundle build...');
  console.log('[build-analysis] Source:', analysisDir);
  console.log('[build-analysis] Output:', outDir);

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    // Check if building for production
    const isProduction = process.env.NODE_ENV === 'production';
    const dropOptions = isProduction ? ['console', 'debugger'] : [];

    // Bundle all analysis modules into a single CJS file
    await esbuild.build({
      entryPoints: [path.join(analysisDir, 'guidelines-evaluator.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',  // CommonJS for Electron compatibility
      outfile: path.join(outDir, 'analysis-bundle.cjs'),
      external: [],  // Bundle all dependencies
      sourcemap: false,
      minify: false,  // Keep readable for debugging
      treeShaking: true,
      drop: dropOptions,
    });

    // Also bundle the classifier separately (in case it's needed)
    await esbuild.build({
      entryPoints: [path.join(analysisDir, 'classifier.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: path.join(outDir, 'classifier-bundle.cjs'),
      external: [],
      sourcemap: false,
      minify: false,
      treeShaking: true,
      drop: dropOptions,
    });

    console.log('[build-analysis] Build complete!');
    console.log('[build-analysis] Output files:');
    console.log('  - dist/analysis/analysis-bundle.cjs');
    console.log('  - dist/analysis/classifier-bundle.cjs');
  } catch (error) {
    console.error('[build-analysis] Build failed:', error);
    process.exit(1);
  }
}

build();
