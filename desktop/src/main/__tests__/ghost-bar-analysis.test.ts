/**
 * Ghost Bar Analysis Unit Tests
 *
 * Tests for analysis caching and variant selection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock crypto module - generate hash based on input text
let lastHashInput = '';
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn((text: string) => {
      lastHashInput = text;
      return { digest: () => `hash-${text.substring(0, 8)}` };
    }),
    digest: vi.fn(() => `hash-${lastHashInput.substring(0, 8)}`),
  })),
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

import {
  getCachedAnalysis,
  cacheAnalysis,
  scoreToGrade,
  selectBestVariant,
  analyzeWithTimeout,
  cancelCurrentAnalysis,
  canBeImproved,
  createGhostBarState,
  clearAnalysisCache,
  getCacheStats,
} from '../ghost-bar-analysis.js';
import type { AnalysisResult, RewriteResult } from '../learning-engine.js';

describe('Ghost Bar Analysis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAnalysisCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAnalysisCache();
  });

  describe('scoreToGrade', () => {
    it('should return A for scores >= 80', () => {
      expect(scoreToGrade(80)).toBe('A');
      expect(scoreToGrade(90)).toBe('A');
      expect(scoreToGrade(100)).toBe('A');
    });

    it('should return B for scores 70-79', () => {
      expect(scoreToGrade(70)).toBe('B');
      expect(scoreToGrade(75)).toBe('B');
      expect(scoreToGrade(79)).toBe('B');
    });

    it('should return C for scores 60-69', () => {
      expect(scoreToGrade(60)).toBe('C');
      expect(scoreToGrade(65)).toBe('C');
      expect(scoreToGrade(69)).toBe('C');
    });

    it('should return D for scores 50-59', () => {
      expect(scoreToGrade(50)).toBe('D');
      expect(scoreToGrade(55)).toBe('D');
      expect(scoreToGrade(59)).toBe('D');
    });

    it('should return F for scores < 50', () => {
      expect(scoreToGrade(0)).toBe('F');
      expect(scoreToGrade(25)).toBe('F');
      expect(scoreToGrade(49)).toBe('F');
    });
  });

  describe('Analysis Cache', () => {
    const mockResult: AnalysisResult = {
      originalPrompt: 'test prompt',
      overallScore: 45,
      grade: 'D',
      goldenScores: {
        goal: 0.5,
        output: 0.4,
        limits: 0.3,
        data: 0.5,
        evaluation: 0.4,
        next: 0.3,
      },
      analysis: {
        goal: { score: 0.5, feedback: '', examples: [] },
        output: { score: 0.4, feedback: '', examples: [] },
        limits: { score: 0.3, feedback: '', examples: [] },
        data: { score: 0.5, feedback: '', examples: [] },
        evaluation: { score: 0.4, feedback: '', examples: [] },
        next: { score: 0.3, feedback: '', examples: [] },
      },
      issues: [],
      promptVariants: [],
      classification: {
        intent: 'code-generation',
        category: 'code',
        intentConfidence: 0.8,
        categoryConfidence: 0.8,
      },
    };

    it('should cache and retrieve analysis', () => {
      const text = 'test prompt';

      cacheAnalysis(text, mockResult);
      const cached = getCachedAnalysis(text);

      expect(cached).toEqual(mockResult);
    });

    it('should return null for non-cached text', () => {
      const cached = getCachedAnalysis('non-existent');
      expect(cached).toBeNull();
    });

    it('should expire cache after TTL', () => {
      const text = 'test prompt';

      cacheAnalysis(text, mockResult);

      // Advance time past TTL (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      const cached = getCachedAnalysis(text);
      expect(cached).toBeNull();
    });

    it('should clear all cache entries', () => {
      cacheAnalysis('text1', mockResult);
      cacheAnalysis('text2', mockResult);

      expect(getCacheStats().size).toBe(2);

      clearAnalysisCache();

      expect(getCacheStats().size).toBe(0);
    });

    it('should report valid entries count', () => {
      cacheAnalysis('text1', mockResult);

      // Add another entry and advance time past TTL for first entry
      vi.advanceTimersByTime(4 * 60 * 1000);
      cacheAnalysis('text2', mockResult);

      vi.advanceTimersByTime(2 * 60 * 1000); // First entry now expired

      const stats = getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.validEntries).toBe(1);
    });
  });

  describe('selectBestVariant', () => {
    it('should prefer AI variant when available', () => {
      const aiVariant: RewriteResult = {
        variant: 'ai',
        rewrittenPrompt: 'AI improved prompt',
        confidence: 0.9,
        improvements: ['Better structure'],
        isAiGenerated: true,
        needsSetup: false,
      };

      const balancedVariant: RewriteResult = {
        variant: 'balanced',
        rewrittenPrompt: 'Balanced improved prompt',
        confidence: 0.7,
        improvements: ['Structure'],
        isAiGenerated: false,
        needsSetup: false,
      };

      const result: AnalysisResult = {
        originalPrompt: 'test',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [balancedVariant, aiVariant],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const selected = selectBestVariant(result);

      expect(selected?.type).toBe('ai');
      expect(selected?.variant.rewrittenPrompt).toBe('AI improved prompt');
    });

    it('should fallback to balanced variant when AI not available', () => {
      const balancedVariant: RewriteResult = {
        variant: 'balanced',
        rewrittenPrompt: 'Balanced improved prompt',
        confidence: 0.7,
        improvements: ['Structure'],
        isAiGenerated: false,
        needsSetup: false,
      };

      const result: AnalysisResult = {
        originalPrompt: 'test',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [balancedVariant],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const selected = selectBestVariant(result);

      expect(selected?.type).toBe('balanced');
    });

    it('should return null when no variants available', () => {
      const result: AnalysisResult = {
        originalPrompt: 'test',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const selected = selectBestVariant(result);

      expect(selected).toBeNull();
    });

    it('should skip AI variant that needs setup', () => {
      const aiVariantNeedsSetup: RewriteResult = {
        variant: 'ai',
        rewrittenPrompt: '',
        confidence: 0,
        improvements: [],
        isAiGenerated: false,
        needsSetup: true,
      };

      const balancedVariant: RewriteResult = {
        variant: 'balanced',
        rewrittenPrompt: 'Balanced improved prompt',
        confidence: 0.7,
        improvements: ['Structure'],
        isAiGenerated: false,
        needsSetup: false,
      };

      const result: AnalysisResult = {
        originalPrompt: 'test',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [aiVariantNeedsSetup, balancedVariant],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const selected = selectBestVariant(result);

      expect(selected?.type).toBe('balanced');
    });
  });

  describe('analyzeWithTimeout', () => {
    it('should return cached result if available', async () => {
      const mockResult: AnalysisResult = {
        originalPrompt: 'test',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      cacheAnalysis('test', mockResult);

      const analyzeFn = vi.fn();
      const result = await analyzeWithTimeout('test', analyzeFn);

      expect(result).toEqual(mockResult);
      expect(analyzeFn).not.toHaveBeenCalled();
    });

    it('should call analyze function if not cached', async () => {
      const mockResult: AnalysisResult = {
        originalPrompt: 'new text',
        overallScore: 50,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const analyzeFn = vi.fn().mockResolvedValue(mockResult);

      const resultPromise = analyzeWithTimeout('new text', analyzeFn);
      vi.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(analyzeFn).toHaveBeenCalledWith('new text');
      expect(result).toEqual(mockResult);
    });

    it('should return null on timeout', async () => {
      const slowAnalyze = vi.fn(() => new Promise(() => {})); // Never resolves

      const resultPromise = analyzeWithTimeout('test', slowAnalyze);

      // Advance past timeout (5 seconds)
      vi.advanceTimersByTime(6000);

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const failingAnalyze = vi.fn().mockRejectedValue(new Error('Analysis failed'));

      const resultPromise = analyzeWithTimeout('test', failingAnalyze);
      vi.advanceTimersByTime(100);
      const result = await resultPromise;

      expect(result).toBeNull();
    });
  });

  describe('cancelCurrentAnalysis', () => {
    it('should cancel ongoing analysis', async () => {
      const slowAnalyze = vi.fn(() => new Promise((resolve) => {
        setTimeout(() => resolve({ overallScore: 50 }), 3000);
      }));

      const resultPromise = analyzeWithTimeout('test', slowAnalyze);

      // Cancel before completion
      cancelCurrentAnalysis();

      vi.advanceTimersByTime(5000);
      const result = await resultPromise;

      expect(result).toBeNull();
    });
  });

  describe('canBeImproved', () => {
    it('should return true for non-A grades', () => {
      expect(canBeImproved({ grade: 'D' } as AnalysisResult)).toBe(true);
      expect(canBeImproved({ grade: 'C' } as AnalysisResult)).toBe(true);
      expect(canBeImproved({ grade: 'B' } as AnalysisResult)).toBe(true);
      expect(canBeImproved({ grade: 'F' } as AnalysisResult)).toBe(true);
    });

    it('should return false for A grade', () => {
      expect(canBeImproved({ grade: 'A' } as AnalysisResult)).toBe(false);
    });
  });

  describe('createGhostBarState', () => {
    it('should create state from analysis result', () => {
      const balancedVariant: RewriteResult = {
        variant: 'balanced',
        rewrittenPrompt: 'Improved prompt text',
        confidence: 0.7,
        improvements: ['Better structure'],
        isAiGenerated: false,
        needsSetup: false,
      };

      const result: AnalysisResult = {
        originalPrompt: 'original',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [balancedVariant],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const state = createGhostBarState('original', result, 'Safari', false);

      expect(state).not.toBeNull();
      expect(state?.originalText).toBe('original');
      expect(state?.improvedText).toBe('Improved prompt text');
      expect(state?.originalGrade).toBe('D');
      expect(state?.variantType).toBe('balanced');
      expect(state?.sourceApp).toBe('Safari');
      expect(state?.isBlockedApp).toBe(false);
    });

    it('should return null when no variant available', () => {
      const result: AnalysisResult = {
        originalPrompt: 'original',
        overallScore: 45,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const state = createGhostBarState('original', result, null, false);

      expect(state).toBeNull();
    });

    it('should calculate improved score based on variant confidence', () => {
      const aiVariant: RewriteResult = {
        variant: 'ai',
        rewrittenPrompt: 'AI improved',
        confidence: 0.9,
        improvements: [],
        isAiGenerated: true,
        needsSetup: false,
      };

      const result: AnalysisResult = {
        originalPrompt: 'original',
        overallScore: 50,
        grade: 'D',
        goldenScores: { goal: 0.5, output: 0.5, limits: 0.5, data: 0.5, evaluation: 0.5, next: 0.5 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [aiVariant],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const state = createGhostBarState('original', result, null, false);

      // Expected: 50 + (0.9 * 30) = 77
      expect(state?.improvedScore).toBe(77);
      expect(state?.improvedGrade).toBe('B');
    });

    it('should cap improved score at 100', () => {
      const aiVariant: RewriteResult = {
        variant: 'ai',
        rewrittenPrompt: 'AI improved',
        confidence: 1.0,
        improvements: [],
        isAiGenerated: true,
        needsSetup: false,
      };

      const result: AnalysisResult = {
        originalPrompt: 'original',
        overallScore: 85,
        grade: 'A',
        goldenScores: { goal: 0.9, output: 0.9, limits: 0.9, data: 0.9, evaluation: 0.9, next: 0.9 },
        analysis: {} as AnalysisResult['analysis'],
        issues: [],
        promptVariants: [aiVariant],
        classification: { intent: 'code-generation', category: 'code', intentConfidence: 0.8, categoryConfidence: 0.8 },
      };

      const state = createGhostBarState('original', result, null, false);

      // Should be capped at 100
      expect(state?.improvedScore).toBe(100);
    });
  });
});
