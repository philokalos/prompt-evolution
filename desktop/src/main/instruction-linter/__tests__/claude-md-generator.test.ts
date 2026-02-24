/**
 * CLAUDE.md Generator Tests (TDD)
 *
 * Tests for two functions:
 *   detectProjectStack:    Scans a directory for config files to infer stack
 *   generateClaudeMdDraft: Produces a CLAUDE.md template from detected stack
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

import fs from 'node:fs';
import {
  detectProjectStack,
  generateClaudeMdDraft,
} from '../claude-md-generator.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupNodeProject(opts?: {
  deps?: Record<string, string>;
  devDeps?: Record<string, string>;
  hasTypeScript?: boolean;
}) {
  const deps = opts?.deps ?? {};
  const devDeps = opts?.devDeps ?? {};
  const hasTs = opts?.hasTypeScript ?? false;

  const pkgJson = JSON.stringify({
    name: 'test-project',
    dependencies: deps,
    devDependencies: devDeps,
  });

  mockExistsSync.mockImplementation((p: unknown) => {
    const filePath = String(p);
    if (filePath.endsWith('package.json')) return true;
    if (hasTs && filePath.endsWith('tsconfig.json')) return true;
    return false;
  });

  mockReadFileSync.mockImplementation((p: unknown) => {
    const filePath = String(p);
    if (filePath.endsWith('package.json')) return pkgJson;
    return '';
  });

  mockReaddirSync.mockReturnValue([
    'package.json',
    ...(hasTs ? ['tsconfig.json'] : []),
  ] as unknown as ReturnType<typeof fs.readdirSync>);
}

function setupEmptyDir() {
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockImplementation(() => {
    throw new Error('ENOENT: no such file');
  });
  mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
}

// ---------------------------------------------------------------------------
// detectProjectStack
// ---------------------------------------------------------------------------

describe('detectProjectStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Node.js project', () => {
    it('should detect typescript from tsconfig.json', () => {
      setupNodeProject({ hasTypeScript: true });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.languages).toContain('typescript');
    });

    it('should detect react from dependencies', () => {
      setupNodeProject({
        deps: { react: '^18.2.0', 'react-dom': '^18.2.0' },
        hasTypeScript: true,
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.languages).toContain('typescript');
      expect(stack.frameworks).toContain('react');
    });

    it('should detect vite from devDependencies', () => {
      setupNodeProject({
        devDeps: { vite: '^5.0.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.buildTools).toContain('vite');
    });

    it('should detect vitest from devDependencies', () => {
      setupNodeProject({
        devDeps: { vitest: '^1.0.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.testFrameworks).toContain('vitest');
    });

    it('should detect multiple frameworks and tools', () => {
      setupNodeProject({
        deps: { react: '^18.0.0', express: '^4.18.0' },
        devDeps: { vite: '^5.0.0', vitest: '^1.0.0', eslint: '^8.0.0' },
        hasTypeScript: true,
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.languages).toContain('typescript');
      expect(stack.frameworks).toContain('react');
      expect(stack.frameworks).toContain('express');
      expect(stack.buildTools).toContain('vite');
      expect(stack.testFrameworks).toContain('vitest');
    });

    it('should detect jest from devDependencies', () => {
      setupNodeProject({
        devDeps: { jest: '^29.0.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.testFrameworks).toContain('jest');
    });

    it('should detect vue from dependencies', () => {
      setupNodeProject({
        deps: { vue: '^3.3.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.frameworks).toContain('vue');
    });

    it('should detect next.js from dependencies', () => {
      setupNodeProject({
        deps: { next: '^14.0.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.frameworks).toContain('next');
    });

    it('should detect webpack from devDependencies', () => {
      setupNodeProject({
        devDeps: { webpack: '^5.0.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.buildTools).toContain('webpack');
    });

    it('should detect esbuild from devDependencies', () => {
      setupNodeProject({
        devDeps: { esbuild: '^0.19.0' },
      });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.buildTools).toContain('esbuild');
    });

    it('should include javascript as language for Node projects without tsconfig', () => {
      setupNodeProject({ hasTypeScript: false });

      const stack = detectProjectStack('/projects/my-app');

      expect(stack.languages).toContain('javascript');
    });
  });

  describe('Python project', () => {
    it('should detect python from requirements.txt', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return 'flask==2.3.0\nrequests==2.31.0\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['requirements.txt'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/py-app');

      expect(stack.languages).toContain('python');
      expect(stack.frameworks).toContain('flask');
    });

    it('should detect django from requirements.txt', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return 'Django==4.2.0\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['requirements.txt'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/py-app');

      expect(stack.languages).toContain('python');
      expect(stack.frameworks).toContain('django');
    });

    it('should detect python from pyproject.toml', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('pyproject.toml')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('pyproject.toml')) return '[project]\nname = "myapp"\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['pyproject.toml'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/py-app');

      expect(stack.languages).toContain('python');
    });

    it('should detect pytest from requirements.txt', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return 'pytest==7.4.0\nflask==2.3.0\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['requirements.txt'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/py-app');

      expect(stack.testFrameworks).toContain('pytest');
    });
  });

  describe('Rust project', () => {
    it('should detect rust from Cargo.toml', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('Cargo.toml')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('Cargo.toml')) {
          return '[package]\nname = "my-crate"\nversion = "0.1.0"\n';
        }
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['Cargo.toml'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/rust-app');

      expect(stack.languages).toContain('rust');
      expect(stack.buildTools).toContain('cargo');
    });
  });

  describe('Go project', () => {
    it('should detect go from go.mod', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('go.mod')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('go.mod')) return 'module example.com/myapp\n\ngo 1.21\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['go.mod'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/go-app');

      expect(stack.languages).toContain('go');
    });
  });

  describe('Mixed stack', () => {
    it('should merge detections from multiple config files', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('package.json')) return true;
        if (filePath.endsWith('tsconfig.json')) return true;
        if (filePath.endsWith('requirements.txt')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('package.json')) {
          return JSON.stringify({
            dependencies: { react: '^18.0.0' },
            devDependencies: { vitest: '^1.0.0' },
          });
        }
        if (filePath.endsWith('requirements.txt')) return 'flask==2.3.0\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['package.json', 'tsconfig.json', 'requirements.txt'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const stack = detectProjectStack('/projects/mixed');

      expect(stack.languages).toContain('typescript');
      expect(stack.languages).toContain('python');
      expect(stack.frameworks).toContain('react');
      expect(stack.frameworks).toContain('flask');
    });
  });

  describe('Empty directory', () => {
    it('should return empty arrays for all fields', () => {
      setupEmptyDir();

      const stack = detectProjectStack('/projects/empty');

      expect(stack.languages).toEqual([]);
      expect(stack.frameworks).toEqual([]);
      expect(stack.buildTools).toEqual([]);
      expect(stack.testFrameworks).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// generateClaudeMdDraft
// ---------------------------------------------------------------------------

describe('generateClaudeMdDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('project name', () => {
    it('should include project name from directory basename', () => {
      setupNodeProject({
        deps: { react: '^18.0.0' },
        hasTypeScript: true,
      });

      const result = generateClaudeMdDraft('/projects/my-cool-app');

      expect(result.draft).toContain('my-cool-app');
    });
  });

  describe('sections', () => {
    it('should include Commands section', () => {
      setupNodeProject({ hasTypeScript: true });

      const result = generateClaudeMdDraft('/projects/app');

      expect(result.draft).toMatch(/## Commands/);
    });

    it('should include Architecture section', () => {
      setupNodeProject({ hasTypeScript: true });

      const result = generateClaudeMdDraft('/projects/app');

      expect(result.draft).toMatch(/## Architecture/);
    });

    it('should include Key Patterns section', () => {
      setupNodeProject({ hasTypeScript: true });

      const result = generateClaudeMdDraft('/projects/app');

      expect(result.draft).toMatch(/## Key Patterns/);
    });

    it('should include Anti-Patterns section', () => {
      setupNodeProject({ hasTypeScript: true });

      const result = generateClaudeMdDraft('/projects/app');

      expect(result.draft).toMatch(/## Anti-Patterns/);
    });
  });

  describe('stack-specific content', () => {
    it('should include npm commands for Node.js projects', () => {
      setupNodeProject({
        devDeps: { vitest: '^1.0.0' },
        hasTypeScript: true,
      });

      const result = generateClaudeMdDraft('/projects/node-app');

      expect(result.draft).toMatch(/npm/);
    });

    it('should include cargo commands for Rust projects', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('Cargo.toml')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('Cargo.toml')) {
          return '[package]\nname = "my-crate"\nversion = "0.1.0"\n';
        }
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['Cargo.toml'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const result = generateClaudeMdDraft('/projects/rust-app');

      expect(result.draft).toMatch(/cargo/);
    });

    it('should include go commands for Go projects', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('go.mod')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('go.mod')) return 'module example.com/app\n\ngo 1.21\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['go.mod'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const result = generateClaudeMdDraft('/projects/go-app');

      expect(result.draft).toMatch(/go /);
    });

    it('should include pip/python commands for Python projects', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('requirements.txt')) return 'django==4.2.0\n';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['requirements.txt'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      const result = generateClaudeMdDraft('/projects/py-app');

      expect(result.draft).toMatch(/pip|python/i);
    });
  });

  describe('confidence scoring', () => {
    it('should return higher confidence with more detected items', () => {
      setupNodeProject({
        deps: { react: '^18.0.0', express: '^4.18.0' },
        devDeps: { vite: '^5.0.0', vitest: '^1.0.0', eslint: '^8.0.0' },
        hasTypeScript: true,
      });

      const richResult = generateClaudeMdDraft('/projects/rich-app');

      setupNodeProject({ hasTypeScript: false });

      const sparseResult = generateClaudeMdDraft('/projects/sparse-app');

      expect(richResult.confidence).toBeGreaterThan(sparseResult.confidence);
    });

    it('should cap confidence at 1.0', () => {
      setupNodeProject({
        deps: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          next: '^14.0.0',
          express: '^4.18.0',
          vue: '^3.3.0',
        },
        devDeps: {
          vite: '^5.0.0',
          webpack: '^5.0.0',
          esbuild: '^0.19.0',
          vitest: '^1.0.0',
          jest: '^29.0.0',
          eslint: '^8.0.0',
        },
        hasTypeScript: true,
      });

      const result = generateClaudeMdDraft('/projects/mega-app');

      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should return 0 confidence for empty directory', () => {
      setupEmptyDir();

      const result = generateClaudeMdDraft('/projects/empty');

      expect(result.confidence).toBe(0);
    });
  });

  describe('detectedStack in result', () => {
    it('should include the detected stack in the result', () => {
      setupNodeProject({
        deps: { react: '^18.0.0' },
        devDeps: { vitest: '^1.0.0' },
        hasTypeScript: true,
      });

      const result = generateClaudeMdDraft('/projects/app');

      expect(result.detectedStack).toBeDefined();
      expect(result.detectedStack.languages).toContain('typescript');
      expect(result.detectedStack.frameworks).toContain('react');
      expect(result.detectedStack.testFrameworks).toContain('vitest');
    });
  });

  describe('edge cases', () => {
    it('should produce valid markdown even for empty directory', () => {
      setupEmptyDir();

      const result = generateClaudeMdDraft('/projects/empty');

      expect(result.draft).toContain('# CLAUDE.md');
      expect(result.draft).toMatch(/## Commands/);
      expect(result.draft).toMatch(/## Architecture/);
    });

    it('should handle malformed package.json gracefully', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('package.json')) return true;
        return false;
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        const filePath = String(p);
        if (filePath.endsWith('package.json')) return '{ invalid json';
        return '';
      });
      mockReaddirSync.mockReturnValue(
        ['package.json'] as unknown as ReturnType<typeof fs.readdirSync>,
      );

      // Should not throw
      const result = generateClaudeMdDraft('/projects/broken');

      expect(result.draft).toContain('# CLAUDE.md');
      expect(result.detectedStack.languages).toContain('javascript');
    });
  });
});
