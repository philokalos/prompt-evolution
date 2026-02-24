/**
 * TopFix Computation Unit Tests (TDD)
 *
 * Tests for the computeTopFix() pure function that extracts
 * the single most impactful improvement from an analysis result.
 */

import { describe, it, expect } from 'vitest';
import { computeTopFix } from '../top-fix.js';

// =============================================================================
// Test data factories
// =============================================================================

function createGoldenScores(overrides: Partial<Record<string, number>> = {}) {
  return {
    goal: 80,
    output: 70,
    limits: 60,
    data: 75,
    evaluation: 50,
    next: 65,
    ...overrides,
  };
}

function createIssue(overrides: Partial<{
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  suggestion: string;
}> = {}) {
  return {
    severity: 'medium' as const,
    category: 'vague-goal',
    message: 'Goal is unclear',
    suggestion: 'Add a clear objective statement',
    ...overrides,
  };
}

function createVariant(overrides: Partial<{
  rewrittenPrompt: string;
  variant: string;
  confidence: number;
  keyChanges: string[];
  variantLabel: string;
}> = {}) {
  return {
    rewrittenPrompt: 'Improved prompt text',
    variant: 'balanced',
    confidence: 75,
    keyChanges: ['Added goal clarity'],
    variantLabel: 'Balanced',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('computeTopFix', () => {
  describe('highest-impact issue selection', () => {
    it('should select the dimension with the lowest score', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ evaluation: 20, goal: 80 }),
        issues: [
          createIssue({ category: 'no-criteria', message: 'No evaluation criteria defined', severity: 'high' }),
          createIssue({ category: 'vague-goal', message: 'Goal is vague', severity: 'medium' }),
        ],
        originalText: 'fix this bug',
        promptVariants: [createVariant({ rewrittenPrompt: 'Goal: Fix the authentication bug in login.ts\n\nExpected: Tests pass' })],
        overallScore: 45,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.dimension).toBe('evaluation');
    });

    it('should pick the highest-severity issue for the weakest dimension', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ output: 25 }),
        issues: [
          createIssue({ category: 'missing-output', message: 'No output format specified', severity: 'high' }),
          createIssue({ category: 'vague-goal', message: 'Goal is vague', severity: 'low' }),
        ],
        originalText: 'make it work',
        promptVariants: [createVariant()],
        overallScore: 40,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.issueDescription).toContain('output format');
    });
  });

  describe('scoreDelta calculation', () => {
    it('should calculate scoreDelta as the gap from 100 for the weakest dimension', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ limits: 30 }),
        issues: [createIssue({ category: 'no-constraints', message: 'No constraints defined', severity: 'high' })],
        originalText: 'write code',
        promptVariants: [createVariant()],
        overallScore: 50,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      // scoreDelta = (100 - 30) / 100 = 0.7
      expect(result!.scoreDelta).toBeCloseTo(0.7, 1);
    });

    it('should return positive scoreDelta', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ data: 45 }),
        issues: [createIssue({ category: 'lacking-context', severity: 'medium' })],
        originalText: 'do something',
        promptVariants: [createVariant()],
        overallScore: 55,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeGreaterThan(0);
    });
  });

  describe('before/after snippet extraction', () => {
    it('should use original text as beforeSnippet (truncated)', () => {
      const originalText = 'fix this bug in the code please I need help';
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 30 }),
        issues: [createIssue({ category: 'vague-goal', severity: 'high' })],
        originalText,
        promptVariants: [createVariant({ rewrittenPrompt: 'Goal: Fix authentication bug in login.ts' })],
        overallScore: 40,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.beforeSnippet).toBe(originalText);
    });

    it('should use best variant rewrittenPrompt as afterSnippet', () => {
      const improved = 'Goal: Fix the authentication bug\nOutput: Return fixed code with tests';
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 30 }),
        issues: [createIssue({ category: 'vague-goal', severity: 'high' })],
        originalText: 'fix bug',
        promptVariants: [createVariant({ rewrittenPrompt: improved, confidence: 75 })],
        overallScore: 40,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.afterSnippet).toBe(improved);
    });

    it('should truncate long snippets to 500 characters', () => {
      const longText = 'a'.repeat(600);
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 20 }),
        issues: [createIssue({ severity: 'high' })],
        originalText: longText,
        promptVariants: [createVariant({ rewrittenPrompt: longText })],
        overallScore: 30,
        grade: 'F',
      });

      expect(result).not.toBeNull();
      expect(result!.beforeSnippet.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(result!.afterSnippet.length).toBeLessThanOrEqual(503);
    });

    it('should select the highest-confidence variant for afterSnippet', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 30 }),
        issues: [createIssue({ severity: 'high' })],
        originalText: 'fix bug',
        promptVariants: [
          createVariant({ rewrittenPrompt: 'conservative fix', confidence: 60, variant: 'conservative' }),
          createVariant({ rewrittenPrompt: 'balanced fix with GOLDEN', confidence: 75, variant: 'balanced' }),
          createVariant({ rewrittenPrompt: 'comprehensive fix', confidence: 95, variant: 'comprehensive' }),
        ],
        overallScore: 40,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.afterSnippet).toBe('comprehensive fix');
    });
  });

  describe('null for A-grade', () => {
    it('should return null when grade is A', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 95, output: 90, limits: 85, data: 90, evaluation: 88, next: 85 }),
        issues: [],
        originalText: 'Well-structured prompt with clear goals',
        promptVariants: [createVariant()],
        overallScore: 92,
        grade: 'A',
      });

      expect(result).toBeNull();
    });

    it('should return null when there are no issues', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 80, output: 75, limits: 70, data: 75, evaluation: 70, next: 70 }),
        issues: [],
        originalText: 'A decent prompt',
        promptVariants: [createVariant()],
        overallScore: 75,
        grade: 'B',
      });

      expect(result).toBeNull();
    });

    it('should return null when no variants are available', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 30 }),
        issues: [createIssue({ severity: 'high' })],
        originalText: 'fix bug',
        promptVariants: [],
        overallScore: 40,
        grade: 'D',
      });

      expect(result).toBeNull();
    });
  });

  describe('totalIssueCount', () => {
    it('should include the total number of issues', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 30, output: 25, limits: 40 }),
        issues: [
          createIssue({ severity: 'high', category: 'vague-goal' }),
          createIssue({ severity: 'medium', category: 'missing-output' }),
          createIssue({ severity: 'low', category: 'no-constraints' }),
        ],
        originalText: 'do something',
        promptVariants: [createVariant()],
        overallScore: 35,
        grade: 'F',
      });

      expect(result).not.toBeNull();
      expect(result!.totalIssueCount).toBe(3);
    });
  });

  describe('dimension-to-issue mapping', () => {
    it('should map goal dimension to vague-goal issues', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ goal: 15 }),
        issues: [
          createIssue({ category: 'vague-goal', message: 'The goal is unclear', severity: 'high' }),
        ],
        originalText: 'help',
        promptVariants: [createVariant()],
        overallScore: 30,
        grade: 'F',
      });

      expect(result).not.toBeNull();
      expect(result!.dimension).toBe('goal');
      expect(result!.issueDescription).toContain('goal');
    });

    it('should fallback to generic description when no matching issue for dimension', () => {
      const result = computeTopFix({
        goldenScores: createGoldenScores({ next: 10, goal: 80 }),
        issues: [
          // Issues don't match the weakest dimension (next)
          createIssue({ category: 'vague-goal', message: 'Goal is vague', severity: 'medium' }),
        ],
        originalText: 'build feature',
        promptVariants: [createVariant()],
        overallScore: 50,
        grade: 'D',
      });

      expect(result).not.toBeNull();
      expect(result!.dimension).toBe('next');
      // Should still provide a description even without matching issue
      expect(result!.issueDescription.length).toBeGreaterThan(0);
    });
  });
});
