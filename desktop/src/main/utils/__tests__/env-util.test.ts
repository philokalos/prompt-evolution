/**
 * Tests for env-util.ts
 * Centralized MAS build detection utility
 *
 * Note: The isMASBuild function caches its result at module level,
 * so we can only test one scenario per test run. These tests verify
 * the development mode behavior (not packaged = not MAS).
 */

import { describe, it, expect, vi } from 'vitest';

// Mock electron - development mode (not packaged)
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/path/to/app',
    getPath: () => '/Users/testuser',
  },
}));

// Mock fs with ESM compatibility
vi.mock('fs', () => ({
  __esModule: true,
  default: { existsSync: () => false },
  existsSync: () => false,
}));

// Mock path with ESM compatibility
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    default: actual,
  };
});

// Import after mocks
import { isMASBuild } from '../env-util.js';

describe('env-util', () => {
  describe('isMASBuild', () => {
    it('should return false in development mode (not packaged)', () => {
      // In development mode (app.isPackaged = false), always returns false
      expect(isMASBuild()).toBe(false);
    });

    it('should return the same cached value on subsequent calls', () => {
      // First call
      const result1 = isMASBuild();
      // Second call should return cached value
      const result2 = isMASBuild();

      expect(result1).toBe(result2);
      expect(result1).toBe(false);
    });

    it('should be a function that takes no arguments', () => {
      expect(typeof isMASBuild).toBe('function');
      expect(isMASBuild.length).toBe(0);
    });
  });
});
