/**
 * Tests for signal scoring utilities
 */
import { describe, it, expect } from 'vitest';
import {
  calculateConfidence,
  SIGNAL_TYPE_MAP,
} from './signal-scorer.js';

describe('calculateConfidence', () => {
  it('returns higher confidence for more keywords', () => {
    const conf1 = calculateConfidence(1, 200);
    const conf2 = calculateConfidence(2, 200);
    const conf3 = calculateConfidence(3, 200);

    expect(conf2).toBeGreaterThan(conf1);
    expect(conf3).toBeGreaterThan(conf2);
  });

  it('caps at maximum confidence', () => {
    const conf = calculateConfidence(10, 200);
    expect(conf).toBeLessThanOrEqual(0.9);
  });

  it('adjusts for content length', () => {
    // Short content = higher confidence
    const shortConf = calculateConfidence(2, 50);
    // Medium content = base confidence
    const medConf = calculateConfidence(2, 200);
    // Long content = lower confidence
    const longConf = calculateConfidence(2, 600);

    expect(shortConf).toBeGreaterThan(medConf);
    expect(medConf).toBeGreaterThan(longConf);
  });

  it('returns 0 for zero keywords', () => {
    const conf = calculateConfidence(0, 200);
    expect(conf).toBe(0);
  });

  it('respects custom config', () => {
    const conf = calculateConfidence(1, 200, {
      baseMultiplier: 0.5,
      maxConfidence: 0.8,
    });

    expect(conf).toBe(0.5); // 1 * 0.5 * 1.0 (medium content factor)
  });

  it('handles short content threshold', () => {
    const confShort = calculateConfidence(2, 50, {
      shortContentThreshold: 100,
      shortContentFactor: 1.2,
    });
    const confMedium = calculateConfidence(2, 150, {
      shortContentThreshold: 100,
      mediumContentThreshold: 500,
    });

    // Short should get 1.2x factor
    expect(confShort).toBeGreaterThan(confMedium);
  });
});

describe('SIGNAL_TYPE_MAP', () => {
  it('maps signal pattern types to result types', () => {
    expect(SIGNAL_TYPE_MAP.positive).toBe('positive_feedback');
    expect(SIGNAL_TYPE_MAP.negative).toBe('negative_feedback');
    expect(SIGNAL_TYPE_MAP.retry).toBe('retry_attempt');
    expect(SIGNAL_TYPE_MAP.completion).toBe('task_completion');
    expect(SIGNAL_TYPE_MAP.question).toBe('question');
    expect(SIGNAL_TYPE_MAP.command).toBe('command');
    expect(SIGNAL_TYPE_MAP.context).toBe('context_providing');
  });

  it('has all expected signal types', () => {
    const expectedTypes = [
      'positive',
      'negative',
      'retry',
      'completion',
      'question',
      'command',
      'context',
    ];

    for (const type of expectedTypes) {
      expect(SIGNAL_TYPE_MAP).toHaveProperty(type);
    }
  });
});
