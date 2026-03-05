/**
 * Rewriter Confidence Module Tests
 *
 * Tests for evidence-based confidence calculation functions.
 * All pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCalibratedConfidence,
  countImprovedDimensions,
  calculateAntiPatternFreeScore,
  calculateContextRichness,
} from '../rewriter/confidence.js';
import type { ConfidenceFactors, GuidelineEvaluation, GOLDENScore } from '../rewriter/types.js';
import type { SessionContext } from '../session-context.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFactors(overrides: Partial<ConfidenceFactors> = {}): ConfidenceFactors {
  return {
    classificationConfidence: 0.5,
    dimensionsImproved: 3,
    antiPatternFree: 0.5,
    templateMatch: 0.5,
    contextRichness: 0.5,
    ...overrides,
  };
}

function makeGoldenScore(overrides: Partial<GOLDENScore> = {}): GOLDENScore {
  return {
    goal: 0.5,
    output: 0.5,
    limits: 0.5,
    data: 0.5,
    evaluation: 0.5,
    next: 0.5,
    total: 50,
    ...overrides,
  };
}

function makeEvaluation(goldenOverrides: Partial<GOLDENScore> = {}): GuidelineEvaluation {
  return {
    overallScore: 50,
    guidelineScores: [],
    goldenScore: makeGoldenScore(goldenOverrides),
    recommendations: [],
    grade: 'C',
  };
}

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    projectPath: '/test/project',
    sessionId: 'test-session',
    techStack: [],
    recentFiles: [],
    recentTools: [],
    lastActivity: new Date(),
    ...overrides,
  } as SessionContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateCalibratedConfidence', () => {
  it('should return near 0.95 when all factors are high', () => {
    const factors = makeFactors({
      classificationConfidence: 1.0,
      dimensionsImproved: 6,
      antiPatternFree: 1.0,
      templateMatch: 1.0,
      contextRichness: 1.0,
    });
    const result = calculateCalibratedConfidence(factors);
    expect(result).toBeCloseTo(0.95, 1);
  });

  it('should clamp to 0.30 when all factors are low', () => {
    const factors = makeFactors({
      classificationConfidence: 0,
      dimensionsImproved: 0,
      antiPatternFree: 0,
      templateMatch: 0,
      contextRichness: 0,
    });
    const result = calculateCalibratedConfidence(factors);
    expect(result).toBe(0.30);
  });

  it('should return intermediate value for mixed factors', () => {
    const factors = makeFactors({
      classificationConfidence: 0.8,
      dimensionsImproved: 3,
      antiPatternFree: 0.7,
      templateMatch: 0.6,
      contextRichness: 0.5,
    });
    const result = calculateCalibratedConfidence(factors);
    expect(result).toBeGreaterThan(0.30);
    expect(result).toBeLessThan(0.95);
  });

  it('should weight classification confidence at 30%', () => {
    const base = makeFactors({ classificationConfidence: 0 });
    const high = makeFactors({ classificationConfidence: 1.0 });
    const diff = calculateCalibratedConfidence(high) - calculateCalibratedConfidence(base);
    expect(diff).toBeCloseTo(0.30, 1);
  });
});

describe('countImprovedDimensions', () => {
  it('should return 6 when all dimensions are below 0.5', () => {
    const eval_ = makeEvaluation({
      goal: 0.1, output: 0.2, limits: 0.3,
      data: 0.1, evaluation: 0.4, next: 0.0,
    });
    expect(countImprovedDimensions(eval_)).toBe(6);
  });

  it('should return 0 when no dimensions are below 0.5', () => {
    const eval_ = makeEvaluation({
      goal: 0.9, output: 0.8, limits: 0.7,
      data: 0.6, evaluation: 0.5, next: 0.5,
    });
    expect(countImprovedDimensions(eval_)).toBe(0);
  });

  it('should count correctly for mixed scores', () => {
    const eval_ = makeEvaluation({
      goal: 0.9, output: 0.3, limits: 0.7,
      data: 0.2, evaluation: 0.8, next: 0.1,
    });
    expect(countImprovedDimensions(eval_)).toBe(3);
  });
});

describe('calculateAntiPatternFreeScore', () => {
  it('should return 1.0 when no anti-patterns', () => {
    expect(calculateAntiPatternFreeScore([])).toBe(1.0);
  });

  it('should penalize high severity patterns heavily', () => {
    const result = calculateAntiPatternFreeScore([{ severity: 'high' }]);
    expect(result).toBeCloseTo(0.7, 1);
  });

  it('should penalize medium severity patterns moderately', () => {
    const result = calculateAntiPatternFreeScore([{ severity: 'medium' }]);
    expect(result).toBeCloseTo(0.85, 1);
  });

  it('should penalize low severity patterns lightly', () => {
    const result = calculateAntiPatternFreeScore([{ severity: 'low' }]);
    expect(result).toBeCloseTo(0.95, 1);
  });

  it('should accumulate penalties from multiple patterns', () => {
    const result = calculateAntiPatternFreeScore([
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'low' },
    ]);
    expect(result).toBeCloseTo(0.5, 1);
  });

  it('should clamp to 0 for extreme penalties', () => {
    const result = calculateAntiPatternFreeScore([
      { severity: 'high' },
      { severity: 'high' },
      { severity: 'high' },
      { severity: 'high' },
    ]);
    expect(result).toBe(0);
  });
});

describe('calculateContextRichness', () => {
  it('should return 0.2 when no context', () => {
    expect(calculateContextRichness(undefined)).toBe(0.2);
  });

  it('should return base 0.3 for empty context', () => {
    const ctx = makeContext();
    expect(calculateContextRichness(ctx)).toBe(0.3);
  });

  it('should increase for tech stack', () => {
    const ctx = makeContext({ techStack: ['React', 'TypeScript'] });
    expect(calculateContextRichness(ctx)).toBe(0.5);
  });

  it('should increase for meaningful current task', () => {
    const ctx = makeContext({ currentTask: 'Implementing auth flow for users' });
    expect(calculateContextRichness(ctx)).toBeCloseTo(0.45, 10);
  });

  it('should not increase for generic current task', () => {
    const ctx = makeContext({ currentTask: '작업 진행 중' });
    expect(calculateContextRichness(ctx)).toBe(0.3);
  });

  it('should increase for recent files', () => {
    const ctx = makeContext({ recentFiles: ['src/app.tsx'] });
    expect(calculateContextRichness(ctx)).toBeCloseTo(0.45, 10);
  });

  it('should increase for git branch', () => {
    const ctx = makeContext({ gitBranch: 'feat/auth' });
    expect(calculateContextRichness(ctx)).toBe(0.4);
  });

  it('should approach 1.0 for full context', () => {
    const ctx = makeContext({
      techStack: ['React', 'TypeScript'],
      currentTask: 'Implementing auth flow for users',
      recentFiles: ['src/auth.tsx'],
      lastExchange: { assistantFiles: [], assistantSummary: 'test' } as SessionContext['lastExchange'],
      gitBranch: 'feat/auth',
    });
    const result = calculateContextRichness(ctx);
    expect(result).toBeGreaterThanOrEqual(0.9);
    expect(result).toBeLessThanOrEqual(1.0);
  });
});
