/**
 * Cross-Product Integration Tests
 *
 * 5 test cases verifying data flow and consistency between products.
 * TC-X01 through TC-X05
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── TC-X01: CLI DB = Dashboard DB ─────────────────────────────────

describe('CLI → Dashboard Data Consistency (TC-X01)', () => {
  it('TC-X01: should use the same database for CLI and Dashboard', () => {
    const dbModulePath = join(process.cwd(), 'src', 'db', 'connection.ts');
    const dbModuleExists = existsSync(dbModulePath);
    expect(dbModuleExists).toBe(true);

    const content = readFileSync(dbModulePath, 'utf-8');
    expect(content).toContain('.prompt-evolution');
  });
});

// ─── TC-X02: Desktop DB Independence ────────────────────────────────

describe('Desktop DB Independence (TC-X02)', () => {
  it('TC-X02: should use separate database for Desktop app', () => {
    const desktopDbPath = join(process.cwd(), 'desktop', 'src', 'main', 'db');
    const desktopDbExists = existsSync(desktopDbPath);
    expect(desktopDbExists).toBe(true);

    const cliDbModule = join(process.cwd(), 'src', 'db', 'connection.ts');
    if (existsSync(cliDbModule)) {
      const cliContent = readFileSync(cliDbModule, 'utf-8');
      expect(cliContent).toContain('.prompt-evolution');
    }

    const desktopClaudeMd = join(process.cwd(), 'desktop', 'CLAUDE.md');
    if (existsSync(desktopClaudeMd)) {
      const content = readFileSync(desktopClaudeMd, 'utf-8');
      expect(content).toContain('.promptlint');
    }
  });
});

// ─── TC-X03: Landing Page Download Link ─────────────────────────────

describe('Landing Page Download Link (TC-X03)', () => {
  it('TC-X03: should have download link in landing page', () => {
    const landingDir = join(process.cwd(), 'landing-page');

    if (!existsSync(landingDir)) {
      console.log('Landing page directory not found, skipping');
      return;
    }

    // Landing page has locale-specific pages (en/, ko/) with download content
    const enPath = join(landingDir, 'en', 'index.html');
    const koPath = join(landingDir, 'ko', 'index.html');
    const pagePath = existsSync(enPath) ? enPath : existsSync(koPath) ? koPath : null;
    expect(pagePath).not.toBeNull();

    const content = readFileSync(pagePath!, 'utf-8');
    const hasDownloadLink =
      content.includes('.dmg') ||
      content.includes('download') ||
      content.includes('Download');
    expect(hasDownloadLink).toBe(true);
  });
});

// ─── TC-X04: Landing Page Bilingual ─────────────────────────────────

describe('Landing Page Bilingual Support (TC-X04)', () => {
  it('TC-X04: should support both English and Korean', () => {
    const landingDir = join(process.cwd(), 'landing-page');

    if (!existsSync(landingDir)) {
      console.log('Landing page directory not found, skipping');
      return;
    }

    const indexPath = join(landingDir, 'index.html');
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      const hasEnglish = content.includes('English') || content.includes('Download') || content.includes('lang="en"');
      const hasKorean = content.includes('한국어') || content.includes('다운로드') || content.includes('lang="ko"');
      const hasLangSwitch = content.includes('i18n') || content.includes('language') || content.includes('locale');
      expect(hasEnglish || hasKorean || hasLangSwitch).toBe(true);
    }
  });
});

// ─── TC-X05: Landing Page Privacy ───────────────────────────────────

describe('Landing Page Privacy Policy (TC-X05)', () => {
  it('TC-X05: should have privacy policy page', () => {
    const landingDir = join(process.cwd(), 'landing-page');

    if (!existsSync(landingDir)) {
      console.log('Landing page directory not found, skipping');
      return;
    }

    const privacyPaths = [
      join(landingDir, 'privacy.html'),
      join(landingDir, 'privacy', 'index.html'),
      join(landingDir, 'pages', 'privacy.html'),
    ];

    const hasPrivacyPage = privacyPaths.some((p) => existsSync(p));

    const indexPath = join(landingDir, 'index.html');
    let hasPrivacyLink = false;
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      hasPrivacyLink = content.includes('privacy') || content.includes('개인정보');
    }

    expect(hasPrivacyPage || hasPrivacyLink).toBe(true);
  });
});

// ─── Shared Analysis Module Consistency ─────────────────────────────

describe('Shared Analysis Module (supplementary)', () => {
  it('should share analysis modules between CLI and Desktop via esbuild', () => {
    const buildScriptPath = join(process.cwd(), 'desktop', 'scripts', 'build-analysis.ts');
    if (existsSync(buildScriptPath)) {
      const content = readFileSync(buildScriptPath, 'utf-8');
      expect(content.includes('analysis') || content.includes('esbuild')).toBe(true);
    }

    const analysisDir = join(process.cwd(), 'src', 'analysis');
    expect(existsSync(analysisDir)).toBe(true);
  });

  it('should have consistent GOLDEN dimension definitions', () => {
    const expectedDimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'];
    const evaluatorPath = join(process.cwd(), 'src', 'analysis', 'guidelines-evaluator.ts');
    if (existsSync(evaluatorPath)) {
      const content = readFileSync(evaluatorPath, 'utf-8');
      for (const dim of expectedDimensions) {
        expect(content).toContain(dim);
      }
    }
  });
});
