/**
 * Module Loader Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Mock electron app before import
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

// Mock fs module
const mockExistsSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (path: string) => mockExistsSync(path),
  default: {
    existsSync: (path: string) => mockExistsSync(path),
  },
}));

// Mock module require
const mockAnalysisModule = {
  evaluatePromptAgainstGuidelines: vi.fn().mockReturnValue({
    overallScore: 0.75,
    goldenScore: { goal: 0.8, output: 0.7 },
  }),
};

const mockClassifierModule = {
  classifyPrompt: vi.fn().mockReturnValue({
    intent: 'code_generation',
    category: 'development',
    confidence: 0.9,
  }),
};

vi.mock('module', () => ({
  createRequire: () => (path: string) => {
    if (path.includes('analysis-bundle')) {
      return mockAnalysisModule;
    }
    if (path.includes('classifier-bundle')) {
      return mockClassifierModule;
    }
    throw new Error(`Module not found: ${path}`);
  },
}));

describe('Module Loader', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockExistsSync.mockReset();

    // Reset modules before each test
    const { resetModules } = await import('../module-loader.js');
    resetModules();
  });

  afterEach(async () => {
    // Clean up after each test
    const { resetModules } = await import('../module-loader.js');
    resetModules();
  });

  describe('areModulesLoaded', () => {
    it('should return false before loading', async () => {
      const { areModulesLoaded } = await import('../module-loader.js');

      expect(areModulesLoaded()).toBe(false);
    });

    it('should return true after successful loading', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, areModulesLoaded } = await import('../module-loader.js');
      await loadAnalysisModules();

      expect(areModulesLoaded()).toBe(true);
    });
  });

  describe('loadAnalysisModules', () => {
    it('should return true when modules load successfully', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules } = await import('../module-loader.js');
      const result = await loadAnalysisModules();

      expect(result).toBe(true);
    });

    it('should return false when analysis bundle does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const { loadAnalysisModules } = await import('../module-loader.js');
      const result = await loadAnalysisModules();

      expect(result).toBe(false);
    });

    it('should return true immediately if already loaded', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules } = await import('../module-loader.js');

      // Load first time
      await loadAnalysisModules();

      // Second load should be instant
      mockExistsSync.mockClear();
      const result = await loadAnalysisModules();

      expect(result).toBe(true);
      // existsSync should not be called again
      expect(mockExistsSync).not.toHaveBeenCalled();
    });

    it('should load classifier module if available', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, getClassifier } = await import('../module-loader.js');
      await loadAnalysisModules();

      const classifier = getClassifier();
      expect(classifier).toBeDefined();
    });
  });

  describe('getEvaluator', () => {
    it('should return null before loading', async () => {
      const { getEvaluator } = await import('../module-loader.js');

      expect(getEvaluator()).toBeNull();
    });

    it('should return evaluator function after loading', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, getEvaluator } = await import('../module-loader.js');
      await loadAnalysisModules();

      const evaluator = getEvaluator();
      expect(evaluator).toBeDefined();
      expect(typeof evaluator).toBe('function');
    });
  });

  describe('getClassifier', () => {
    it('should return null before loading', async () => {
      const { getClassifier } = await import('../module-loader.js');

      expect(getClassifier()).toBeNull();
    });

    it('should return classifier function after loading', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, getClassifier } = await import('../module-loader.js');
      await loadAnalysisModules();

      const classifier = getClassifier();
      expect(classifier).toBeDefined();
      expect(typeof classifier).toBe('function');
    });
  });

  describe('resetModules', () => {
    it('should reset evaluator to null', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, getEvaluator, resetModules } = await import(
        '../module-loader.js'
      );
      await loadAnalysisModules();

      expect(getEvaluator()).not.toBeNull();

      resetModules();

      expect(getEvaluator()).toBeNull();
    });

    it('should reset classifier to null', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, getClassifier, resetModules } = await import(
        '../module-loader.js'
      );
      await loadAnalysisModules();

      expect(getClassifier()).not.toBeNull();

      resetModules();

      expect(getClassifier()).toBeNull();
    });

    it('should allow reloading after reset', async () => {
      mockExistsSync.mockReturnValue(true);

      const { loadAnalysisModules, areModulesLoaded, resetModules } = await import(
        '../module-loader.js'
      );

      await loadAnalysisModules();
      expect(areModulesLoaded()).toBe(true);

      resetModules();
      expect(areModulesLoaded()).toBe(false);

      await loadAnalysisModules();
      expect(areModulesLoaded()).toBe(true);
    });
  });

});
