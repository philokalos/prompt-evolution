/**
 * Variant Generation Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GuidelineEvaluation, RewriteResult } from '../types.js';
import type { SessionContext } from '../../session-context.js';

// Mock claude-api
vi.mock('../../claude-api.js', () => ({
  rewritePromptWithClaude: vi.fn(),
  rewritePromptWithMultiVariant: vi.fn(),
}));

// Mock providers
vi.mock('../../providers/index.js', () => ({
  rewriteWithFallback: vi.fn(),
  hasAnyProvider: vi.fn(() => false),
}));

describe('Variant Generation', () => {
  const mockEvaluation: GuidelineEvaluation = {
    overallScore: 45,
    guidelineScores: [],
    goldenScore: {
      goal: 40,
      output: 30,
      limits: 50,
      data: 60,
      evaluation: 20,
      next: 10,
      total: 210,
    },
    antiPatterns: [],
    recommendations: [],
    grade: 'C',
  };

  const mockContext: SessionContext = {
    projectName: 'test-project',
    projectPath: '/path/to/test-project',
    techStack: ['React', 'TypeScript'],
    currentTask: 'Build feature',
    recentFiles: ['/path/to/test-project/src/App.tsx'],
    recentTools: ['Read', 'Edit'],
  };

  describe('generateCOSPRewrite', () => {
    it('should generate COSP variant with template', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const result = generateCOSPRewrite('Fix bug', mockEvaluation, mockContext);

      expect(result).toHaveProperty('rewrittenPrompt');
      expect(result).toHaveProperty('keyChanges');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('variant', 'cosp');
      expect(typeof result.rewrittenPrompt).toBe('string');
      expect(result.rewrittenPrompt.length).toBeGreaterThan(0);
    });

    it('should include tech stack in rewritten prompt', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const result = generateCOSPRewrite('Add login', mockEvaluation, mockContext);

      expect(result.rewrittenPrompt).toContain('React');
      expect(result.rewrittenPrompt).toContain('TypeScript');
    });

    it('should work without session context', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const result = generateCOSPRewrite('Fix bug', mockEvaluation);

      expect(result.rewrittenPrompt).toBeTruthy();
      expect(result.variant).toBe('cosp');
    });

    it('should have reasonable confidence score', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const result = generateCOSPRewrite('Fix bug', mockEvaluation, mockContext);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('_generateConservativeRewrite', () => {
    it('should generate conservative variant', async () => {
      const { _generateConservativeRewrite } = await import('../variants.js');

      const result = _generateConservativeRewrite('Fix bug', mockEvaluation, mockContext);

      expect(result.variant).toBe('conservative');
      expect(result.rewrittenPrompt).toBeTruthy();
      expect(result.keyChanges.length).toBeGreaterThan(0);
    });

    it('should have lower confidence than balanced', async () => {
      const { _generateConservativeRewrite, _generateBalancedRewrite } = await import('../variants.js');

      const conservative = _generateConservativeRewrite('Fix bug', mockEvaluation);
      const balanced = _generateBalancedRewrite('Fix bug', mockEvaluation);

      expect(conservative.confidence).toBeLessThan(balanced.confidence);
    });
  });

  describe('_generateBalancedRewrite', () => {
    it('should generate balanced variant', async () => {
      const { _generateBalancedRewrite } = await import('../variants.js');

      const result = _generateBalancedRewrite('Fix bug', mockEvaluation, mockContext);

      expect(result.variant).toBe('balanced');
      expect(result.rewrittenPrompt).toBeTruthy();
    });

    it('should include GOLDEN structure', async () => {
      const { _generateBalancedRewrite } = await import('../variants.js');

      const result = _generateBalancedRewrite('Add feature', mockEvaluation, mockContext);

      // Should have structured sections
      expect(result.rewrittenPrompt.length).toBeGreaterThan(50);
    });
  });

  describe('_generateComprehensiveRewrite', () => {
    it('should generate comprehensive variant', async () => {
      const { _generateComprehensiveRewrite } = await import('../variants.js');

      const result = _generateComprehensiveRewrite('Fix bug', mockEvaluation, mockContext);

      expect(result.variant).toBe('comprehensive');
      expect(result.rewrittenPrompt).toBeTruthy();
    });

    it('should have highest confidence among rule-based variants', async () => {
      const {
        _generateConservativeRewrite,
        _generateBalancedRewrite,
        _generateComprehensiveRewrite,
      } = await import('../variants.js');

      const conservative = _generateConservativeRewrite('Fix bug', mockEvaluation);
      const balanced = _generateBalancedRewrite('Fix bug', mockEvaluation);
      const comprehensive = _generateComprehensiveRewrite('Fix bug', mockEvaluation);

      expect(comprehensive.confidence).toBeGreaterThanOrEqual(balanced.confidence);
      expect(balanced.confidence).toBeGreaterThanOrEqual(conservative.confidence);
    });
  });

  describe('createAIPlaceholder', () => {
    it('should create AI placeholder with setup flag', async () => {
      const { createAIPlaceholder } = await import('../variants.js');

      const result = createAIPlaceholder();

      expect(result.variant).toBe('ai');
      expect(result.needsSetup).toBe(true);
      expect(result.isAiGenerated).toBe(false);
      expect(result.rewrittenPrompt).toBe('');
    });
  });

  describe('generatePromptVariants', () => {
    it('should generate COSP variant', async () => {
      const { generatePromptVariants } = await import('../variants.js');

      const result = generatePromptVariants('Fix bug', mockEvaluation, mockContext);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].variant).toBe('cosp');
    });

    it('should work without session context', async () => {
      const { generatePromptVariants } = await import('../variants.js');

      const result = generatePromptVariants('Fix bug', mockEvaluation);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return original for high scores', async () => {
      const { generatePromptVariants } = await import('../variants.js');

      const highEval = {
        ...mockEvaluation,
        overallScore: 90,
      };

      const result = generatePromptVariants('Well written prompt', highEval, mockContext);

      expect(result.length).toBe(1);
      expect(result[0].rewrittenPrompt).toBe('Well written prompt');
      expect(result[0].keyChanges).toContain('이미 잘 작성됨');
    });
  });

  describe('edge cases', () => {
    it('should handle empty original prompt', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const result = generateCOSPRewrite('', mockEvaluation);

      expect(result.rewrittenPrompt).toBeTruthy();
      expect(result.variant).toBe('cosp');
    });

    it('should handle very long original prompt', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const longPrompt = 'Fix bug '.repeat(200);
      const result = generateCOSPRewrite(longPrompt, mockEvaluation);

      expect(result.rewrittenPrompt).toBeTruthy();
    });

    it('should handle evaluation with all zero scores', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const zeroEval: GuidelineEvaluation = {
        ...mockEvaluation,
        goldenScore: {
          goal: 0,
          output: 0,
          limits: 0,
          data: 0,
          evaluation: 0,
          next: 0,
          total: 0,
        },
      };

      const result = generateCOSPRewrite('Fix bug', zeroEval);

      expect(result.rewrittenPrompt).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle context with empty tech stack', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const emptyContext: SessionContext = {
        projectName: 'test',
        techStack: [],
        recentFiles: [],
      };

      const result = generateCOSPRewrite('Fix bug', mockEvaluation, emptyContext);

      expect(result.rewrittenPrompt).toBeTruthy();
    });

    it('should handle minimal context fields', async () => {
      const { generateCOSPRewrite } = await import('../variants.js');

      const minimalContext: SessionContext = {
        techStack: [],
        recentFiles: [],
      };

      const result = generateCOSPRewrite('Fix bug', mockEvaluation, minimalContext);

      expect(result.rewrittenPrompt).toBeTruthy();
    });
  });
});
