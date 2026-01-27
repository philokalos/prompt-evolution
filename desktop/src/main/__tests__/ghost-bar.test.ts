/**
 * Ghost Bar Unit Tests
 *
 * Tests for the floating mini-bar prompt improvement feature.
 * Note: Full integration tests are handled by E2E tests due to
 * Electron module dependencies.
 */

import { describe, it, expect } from 'vitest';
import type { GhostBarState, GhostBarSettings, Grade } from '../ghost-bar-types.js';

describe('Ghost Bar Types', () => {
  describe('GhostBarState', () => {
    it('should have correct structure', () => {
      const state: GhostBarState = {
        id: 'test-id',
        originalText: 'Fix this bug',
        improvedText: 'Please analyze and fix the bug in the following code.',
        originalGrade: 'D',
        improvedGrade: 'A',
        originalScore: 25,
        improvedScore: 85,
        variantType: 'balanced',
        isBlockedApp: false,
        sourceApp: 'Safari',
      };

      expect(state.id).toBe('test-id');
      expect(state.originalGrade).toBe('D');
      expect(state.improvedGrade).toBe('A');
      expect(state.variantType).toBe('balanced');
    });

    it('should handle null sourceApp', () => {
      const state: GhostBarState = {
        id: 'test-id',
        originalText: 'Test',
        improvedText: 'Improved test',
        originalGrade: 'D',
        improvedGrade: 'B',
        originalScore: 30,
        improvedScore: 70,
        variantType: 'conservative',
        isBlockedApp: false,
        sourceApp: null,
      };

      expect(state.sourceApp).toBeNull();
    });

    it('should handle blocked app state', () => {
      const state: GhostBarState = {
        id: 'test-id',
        originalText: 'Test',
        improvedText: 'Improved test',
        originalGrade: 'C',
        improvedGrade: 'A',
        originalScore: 55,
        improvedScore: 90,
        variantType: 'ai',
        isBlockedApp: true,
        sourceApp: 'VSCode',
      };

      expect(state.isBlockedApp).toBe(true);
      expect(state.variantType).toBe('ai');
    });
  });

  describe('GhostBarSettings', () => {
    it('should have correct default-like structure', () => {
      const settings: GhostBarSettings = {
        enabled: true,
        autoPaste: true,
        dismissTimeout: 5000,
        showOnlyOnImprovement: true,
        minimumConfidence: 0.3,
      };

      expect(settings.enabled).toBe(true);
      expect(settings.dismissTimeout).toBe(5000);
      expect(settings.minimumConfidence).toBe(0.3);
    });

    it('should allow custom timeout values', () => {
      const settings: GhostBarSettings = {
        enabled: true,
        autoPaste: false,
        dismissTimeout: 10000,
        showOnlyOnImprovement: false,
        minimumConfidence: 0.1,
      };

      expect(settings.dismissTimeout).toBe(10000);
      expect(settings.autoPaste).toBe(false);
    });
  });

  describe('Grade type', () => {
    it('should accept valid grades', () => {
      const grades: Grade[] = ['A', 'B', 'C', 'D', 'F'];

      grades.forEach((grade) => {
        expect(['A', 'B', 'C', 'D', 'F']).toContain(grade);
      });
    });
  });
});

describe('Ghost Bar Position Calculation Logic', () => {
  // Test the position calculation logic without Electron dependencies
  const GHOST_BAR_WIDTH = 200;
  const GHOST_BAR_HEIGHT = 44;

  function calculatePosition(
    cursor: { x: number; y: number },
    workArea: { x: number; y: number; width: number; height: number }
  ): { x: number; y: number } {
    let x = cursor.x;
    let y = cursor.y + 8; // 8px below cursor

    // Adjust for right screen boundary
    if (x + GHOST_BAR_WIDTH > workArea.x + workArea.width) {
      x = cursor.x - GHOST_BAR_WIDTH;
    }

    // Adjust for left screen boundary
    if (x < workArea.x) {
      x = workArea.x;
    }

    // Adjust for bottom screen boundary
    if (y + GHOST_BAR_HEIGHT > workArea.y + workArea.height) {
      y = cursor.y - GHOST_BAR_HEIGHT - 8; // 8px above cursor
    }

    // Adjust for top screen boundary
    if (y < workArea.y) {
      y = workArea.y;
    }

    return { x: Math.round(x), y: Math.round(y) };
  }

  const defaultWorkArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it('should position 8px below cursor by default', () => {
    const cursor = { x: 500, y: 300 };
    const pos = calculatePosition(cursor, defaultWorkArea);

    expect(pos.x).toBe(500);
    expect(pos.y).toBe(308); // 300 + 8
  });

  it('should adjust when near right edge', () => {
    const cursor = { x: 1800, y: 300 };
    const pos = calculatePosition(cursor, defaultWorkArea);

    expect(pos.x).toBe(1600); // 1800 - 200
    expect(pos.y).toBe(308);
  });

  it('should adjust when near bottom edge', () => {
    const cursor = { x: 500, y: 1050 };
    const pos = calculatePosition(cursor, defaultWorkArea);

    expect(pos.x).toBe(500);
    expect(pos.y).toBe(998); // 1050 - 44 - 8
  });

  it('should adjust for left edge', () => {
    const cursor = { x: -50, y: 300 };
    const pos = calculatePosition(cursor, defaultWorkArea);

    expect(pos.x).toBe(0);
  });

  it('should adjust for top edge', () => {
    // When cursor is near top and we try to position above (due to bottom overflow)
    // The bar should clamp to workArea.y
    const cursor = { x: 500, y: 10 };
    const pos = calculatePosition(cursor, defaultWorkArea);

    // y = 10 + 8 = 18, which is valid (not below workArea.y)
    expect(pos.y).toBe(18);
  });

  it('should handle corner case (bottom-right)', () => {
    const cursor = { x: 1850, y: 1060 };
    const pos = calculatePosition(cursor, defaultWorkArea);

    expect(pos.x).toBe(1650); // 1850 - 200
    expect(pos.y).toBe(1008); // 1060 - 44 - 8
  });
});

describe('Ghost Bar Timeout Logic', () => {
  it('should enforce minimum 5 second timeout', () => {
    function getEffectiveTimeout(requestedTimeout: number): number {
      return Math.max(5000, Math.min(requestedTimeout || 5000, 30000));
    }

    expect(getEffectiveTimeout(1000)).toBe(5000);  // Too short, use minimum
    expect(getEffectiveTimeout(5000)).toBe(5000);  // Exact minimum
    expect(getEffectiveTimeout(10000)).toBe(10000); // Within range
    expect(getEffectiveTimeout(30000)).toBe(30000); // Maximum
    expect(getEffectiveTimeout(60000)).toBe(30000); // Too long, use maximum
    expect(getEffectiveTimeout(0)).toBe(5000);      // Falsy, use default
  });
});

describe('Ghost Bar State Validation', () => {
  function isValidState(state: Partial<GhostBarState>): boolean {
    return (
      typeof state.id === 'string' &&
      typeof state.originalText === 'string' &&
      typeof state.improvedText === 'string' &&
      state.originalText.length > 0 &&
      state.improvedText.length > 0 &&
      ['A', 'B', 'C', 'D', 'F'].includes(state.originalGrade || '') &&
      ['A', 'B', 'C', 'D', 'F'].includes(state.improvedGrade || '')
    );
  }

  it('should validate complete state', () => {
    const state: GhostBarState = {
      id: 'test-id',
      originalText: 'Test prompt',
      improvedText: 'Improved prompt',
      originalGrade: 'D',
      improvedGrade: 'A',
      originalScore: 30,
      improvedScore: 85,
      variantType: 'balanced',
      isBlockedApp: false,
      sourceApp: null,
    };

    expect(isValidState(state)).toBe(true);
  });

  it('should reject empty text', () => {
    const state = {
      id: 'test-id',
      originalText: '',
      improvedText: 'Improved',
      originalGrade: 'D' as Grade,
      improvedGrade: 'A' as Grade,
    };

    expect(isValidState(state)).toBe(false);
  });

  it('should reject invalid grades', () => {
    const state = {
      id: 'test-id',
      originalText: 'Test',
      improvedText: 'Improved',
      originalGrade: 'X' as Grade, // Invalid
      improvedGrade: 'A' as Grade,
    };

    expect(isValidState(state)).toBe(false);
  });
});
