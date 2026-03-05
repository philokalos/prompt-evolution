/**
 * Ghost Bar History Verification Tests (T022)
 *
 * Tests the data flow: Ghost Bar Apply → saveAnalysis called with correct data.
 * Since the callback wiring lives in index.ts (not easily importable), we test
 * the logic pattern directly rather than the actual registration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto for ghost-bar-analysis imports
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
} from '../ghost-bar-analysis.js';
import type { GhostBarState } from '../ghost-bar-types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeGhostBarState(overrides: Partial<GhostBarState> = {}): GhostBarState {
  return {
    id: 'test-id',
    originalText: 'fix the bug in auth',
    improvedText: '[Goal]\nFix the authentication bug...',
    originalGrade: 'D',
    improvedGrade: 'B',
    originalScore: 35,
    improvedScore: 72,
    variantType: 'conservative',
    isBlockedApp: false,
    sourceApp: 'Cursor',
    ...overrides,
  };
}

const mockAnalysisResult = {
  overallScore: 35,
  grade: 'D' as const,
  goldenScores: {
    goal: 0.3,
    output: 0.2,
    limits: 0.1,
    data: 0.4,
    evaluation: 0.2,
    next: 0.1,
  },
  issues: [{ dimension: 'goal', severity: 'high', description: 'Vague goal' }],
  promptVariants: [],
  improvedText: '[Goal]\nFix the authentication bug...',
  improvedGrade: 'B' as const,
  improvedScore: 72,
};

/**
 * Simulate the T022 callback logic from index.ts
 * This mirrors the actual code at index.ts:785-807
 */
function simulateApplyCallback(
  state: GhostBarState,
  _getCachedAnalysis: typeof getCachedAnalysis,
  saveAnalysisFn: (record: Record<string, unknown>) => void,
) {
  try {
    const cached = _getCachedAnalysis(state.originalText);
    if (cached) {
      saveAnalysisFn({
        promptText: state.originalText,
        overallScore: cached.overallScore,
        grade: cached.grade,
        goldenScores: cached.goldenScores,
        issues: cached.issues,
        improvedPrompt: state.improvedText,
        sourceApp: state.sourceApp ?? undefined,
      });
    }
  } catch {
    // Errors caught, no throw — matches production behavior
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Ghost Bar History (T022)', () => {
  const mockSaveAnalysis = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save analysis when cache hit exists', () => {
    const state = makeGhostBarState();

    // Pre-populate cache
    cacheAnalysis(state.originalText, mockAnalysisResult);

    simulateApplyCallback(state, getCachedAnalysis, mockSaveAnalysis);

    expect(mockSaveAnalysis).toHaveBeenCalledTimes(1);
    const record = mockSaveAnalysis.mock.calls[0][0];
    expect(record.promptText).toBe(state.originalText);
    expect(record.overallScore).toBe(35);
    expect(record.grade).toBe('D');
    expect(record.improvedPrompt).toBe(state.improvedText);
    expect(record.sourceApp).toBe('Cursor');
  });

  it('should NOT save analysis when no cache', () => {
    const state = makeGhostBarState({ originalText: 'uncached-text-xyz' });

    simulateApplyCallback(state, getCachedAnalysis, mockSaveAnalysis);

    expect(mockSaveAnalysis).not.toHaveBeenCalled();
  });

  it('should convert null sourceApp to undefined', () => {
    const state = makeGhostBarState({ sourceApp: null });

    cacheAnalysis(state.originalText, mockAnalysisResult);
    simulateApplyCallback(state, getCachedAnalysis, mockSaveAnalysis);

    const record = mockSaveAnalysis.mock.calls[0][0];
    expect(record.sourceApp).toBeUndefined();
  });

  it('should not throw when saveAnalysis throws', () => {
    const state = makeGhostBarState();
    cacheAnalysis(state.originalText, mockAnalysisResult);

    const throwingSave = vi.fn(() => { throw new Error('DB error'); });

    // Should not throw
    expect(() => {
      simulateApplyCallback(state, getCachedAnalysis, throwingSave);
    }).not.toThrow();
  });

  it('should include goldenScores and issues from cached analysis', () => {
    const state = makeGhostBarState();
    cacheAnalysis(state.originalText, mockAnalysisResult);

    simulateApplyCallback(state, getCachedAnalysis, mockSaveAnalysis);

    const record = mockSaveAnalysis.mock.calls[0][0];
    expect(record.goldenScores).toEqual(mockAnalysisResult.goldenScores);
    expect(record.issues).toEqual(mockAnalysisResult.issues);
  });
});
