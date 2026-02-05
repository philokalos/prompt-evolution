/**
 * Tests for keyword matching utilities
 */
import { describe, it, expect } from 'vitest';
import {
  escapeRegex,
  matchWithWordBoundary,
  matchSubstring,
  getPositionWeight,
  matchMultilingualKeywords,
  calculateMatchScore,
} from './keyword-matcher.js';

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('test.*')).toBe('test\\.\\*');
    expect(escapeRegex('a+b?c')).toBe('a\\+b\\?c');
    expect(escapeRegex('foo(bar)')).toBe('foo\\(bar\\)');
    expect(escapeRegex('[a-z]')).toBe('\\[a-z\\]');
  });

  it('leaves normal text unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
    expect(escapeRegex('simple text')).toBe('simple text');
  });
});

describe('matchWithWordBoundary', () => {
  it('matches whole words', () => {
    expect(matchWithWordBoundary('fix the bug', 'fix')).toBe(true);
    expect(matchWithWordBoundary('fix the bug', 'bug')).toBe(true);
    expect(matchWithWordBoundary('fix the bug', 'the')).toBe(true);
  });

  it('does not match partial words', () => {
    expect(matchWithWordBoundary('fixing the bug', 'fix')).toBe(false);
    expect(matchWithWordBoundary('bugfix', 'bug')).toBe(false);
    expect(matchWithWordBoundary('prefix', 'fix')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(matchWithWordBoundary('Fix the Bug', 'fix')).toBe(true);
    expect(matchWithWordBoundary('fix the bug', 'FIX')).toBe(true);
  });

  it('escapes special regex characters to prevent regex errors', () => {
    // The function should not throw errors with special characters
    // Word boundaries may not work as expected with non-word characters
    expect(() => matchWithWordBoundary('c++ code', 'c++')).not.toThrow();
    expect(() => matchWithWordBoundary('use .env file', '.env')).not.toThrow();

    // These match because regex characters are escaped
    expect(matchWithWordBoundary('test * wildcard', '*')).toBe(false); // * alone isn't a word
    expect(matchWithWordBoundary('use foo.bar', 'foo.bar')).toBe(true); // escaped dot matches literal
  });
});

describe('matchSubstring', () => {
  it('matches substrings', () => {
    expect(matchSubstring('버그를 수정해주세요', '수정')).toBe(true);
    expect(matchSubstring('코드 리뷰', '리뷰')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(matchSubstring('Hello World', 'hello')).toBe(true);
    expect(matchSubstring('WORLD', 'world')).toBe(true);
  });

  it('returns false when substring not found', () => {
    expect(matchSubstring('hello world', 'foo')).toBe(false);
  });
});

describe('getPositionWeight', () => {
  it('returns higher weight for keywords at start', () => {
    const text = 'fix the bug in the code, then add tests';
    // "fix" is at position 0, which is < 25% threshold
    expect(getPositionWeight(text, 'fix')).toBe(1.5);
  });

  it('returns default weight for keywords at end', () => {
    const text = 'please add tests and then fix the bug';
    // "fix" is near the end, > 25% threshold
    expect(getPositionWeight(text, 'fix')).toBe(1.0);
  });

  it('returns default weight when keyword not found', () => {
    expect(getPositionWeight('hello world', 'foo')).toBe(1.0);
  });

  it('respects custom config', () => {
    const text = 'fix the bug';
    expect(
      getPositionWeight(text, 'fix', {
        threshold: 0.5,
        earlyMultiplier: 2.0,
      })
    ).toBe(2.0);
  });
});

describe('matchMultilingualKeywords', () => {
  it('matches both Korean and English keywords', () => {
    const patterns = {
      ko: ['수정', '버그'],
      en: ['fix', 'bug'],
    };

    const results = matchMultilingualKeywords('버그를 fix 해주세요', patterns);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.keyword)).toContain('버그');
    expect(results.map((r) => r.keyword)).toContain('fix');
  });

  it('returns empty array when no matches', () => {
    const patterns = {
      ko: ['수정'],
      en: ['fix'],
    };

    const results = matchMultilingualKeywords('hello world', patterns);
    expect(results).toHaveLength(0);
  });

  it('includes position weights', () => {
    const patterns = {
      ko: [] as string[],
      en: ['fix', 'bug'],
    };

    const text = 'fix the bug at the end';
    const results = matchMultilingualKeywords(text, patterns);

    const fixResult = results.find((r) => r.keyword === 'fix');
    expect(fixResult?.weight).toBe(1.5); // At start

    const bugResult = results.find((r) => r.keyword === 'bug');
    expect(bugResult?.weight).toBe(1.0); // Not at start
  });
});

describe('calculateMatchScore', () => {
  it('calculates scores from match results', () => {
    const results = [
      { keyword: 'fix', weight: 1.5 },
      { keyword: 'bug', weight: 1.0 },
      { keyword: '수정', weight: 1.5 },
    ];

    const score = calculateMatchScore(results);

    expect(score.baseScore).toBe(3);
    expect(score.positionBonus).toBe(1.0); // (1.5-1) + (1.0-1) + (1.5-1) = 1.0
    expect(score.totalScore).toBe(4.0);
  });

  it('handles empty results', () => {
    const score = calculateMatchScore([]);

    expect(score.baseScore).toBe(0);
    expect(score.positionBonus).toBe(0);
    expect(score.totalScore).toBe(0);
  });
});
