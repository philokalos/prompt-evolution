/**
 * Suggestion Generator Tests (TDD)
 *
 * Tests for generateSuggestions() that creates actionable fixes for issues:
 *   merge:       duplicate → consolidated version
 *   resolve:     conflict → clarified version
 *   add-section: missing → section template
 *   specify:     vague → concrete version
 *   remove:      security → redacted version
 *   split:       excessive → split guidance
 */

import { describe, it, expect } from 'vitest';
import {
  generateSuggestions,
  type SuggestionInput,
  type InstructionSuggestion,
} from '../suggestion-generator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function suggestion(issues: SuggestionInput['issues']): InstructionSuggestion[] {
  return generateSuggestions({ issues });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateSuggestions', () => {
  describe('merge (duplicate → consolidated)', () => {
    it('should generate merge suggestion for duplicates', () => {
      const suggestions = suggestion([
        {
          type: 'duplicate',
          severity: 'medium',
          description: 'Duplicate instruction in "Rules" and "Style"',
          location: { lineStart: 5, lineEnd: 5 },
          relatedLines: [
            'Always use strict TypeScript mode.',
            'Always use strict TypeScript mode.',
          ],
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('merge');
      expect(suggestions[0].issueIndex).toBe(0);
      expect(suggestions[0].suggestedText).toBeTruthy();
      expect(suggestions[0].description).toMatch(/consolidat|merg|single/i);
    });
  });

  describe('resolve (conflict → clarified)', () => {
    it('should generate resolve suggestion for conflicts', () => {
      const suggestions = suggestion([
        {
          type: 'conflict',
          severity: 'critical',
          description: 'Contradicting instructions',
          location: { lineStart: 1, lineEnd: 5 },
          relatedLines: [
            'Always use semicolons.',
            'Never use semicolons.',
          ],
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('resolve');
      expect(suggestions[0].suggestedText).toBeTruthy();
      expect(suggestions[0].description).toMatch(/conflict|contradict|resolv/i);
    });

    it('should include both conflicting lines in suggestion context', () => {
      const suggestions = suggestion([
        {
          type: 'conflict',
          severity: 'critical',
          description: 'Contradicting: "Always use tabs" vs "Never use tabs"',
          location: { lineStart: 1, lineEnd: 3 },
          relatedLines: ['Always use tabs.', 'Never use tabs.'],
        },
      ]);

      expect(suggestions[0].originalText).toBeTruthy();
    });
  });

  describe('add-section (missing → template)', () => {
    it('should generate section template for missing commands', () => {
      const suggestions = suggestion([
        {
          type: 'missing',
          severity: 'high',
          description: 'Missing build/test commands section.',
          location: { lineStart: 0, lineEnd: 0 },
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('add-section');
      expect(suggestions[0].suggestedText).toMatch(/command|build|test/i);
    });

    it('should generate section template for missing project description', () => {
      const suggestions = suggestion([
        {
          type: 'missing',
          severity: 'high',
          description: 'Missing project description/overview.',
          location: { lineStart: 0, lineEnd: 0 },
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('add-section');
      expect(suggestions[0].suggestedText).toMatch(/project|overview|description/i);
    });
  });

  describe('specify (vague → concrete)', () => {
    it('should generate specific alternative for vague instructions', () => {
      const suggestions = suggestion([
        {
          type: 'vague',
          severity: 'medium',
          description: 'Vague instruction: "Write good code."',
          location: { lineStart: 5, lineEnd: 5 },
          relatedLines: ['Write good code.'],
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('specify');
      expect(suggestions[0].originalText).toBe('Write good code.');
      expect(suggestions[0].suggestedText).toBeTruthy();
      expect(suggestions[0].suggestedText.length).toBeGreaterThan(suggestions[0].originalText!.length);
    });
  });

  describe('remove (security → redacted)', () => {
    it('should generate redacted version for security issues', () => {
      const suggestions = suggestion([
        {
          type: 'security',
          severity: 'critical',
          description: 'Potential secret detected.',
          location: { lineStart: 3, lineEnd: 3 },
          relatedLines: ['API_KEY=sk-ant-api03-realkey12345'],
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('remove');
      expect(suggestions[0].suggestedText).toMatch(/\.env|environment|placeholder|your/i);
    });
  });

  describe('split (excessive → guidance)', () => {
    it('should generate split guidance for excessive files', () => {
      const suggestions = suggestion([
        {
          type: 'excessive',
          severity: 'high',
          description: 'File has 500 lines.',
          location: { lineStart: 1, lineEnd: 500 },
        },
      ]);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('split');
      expect(suggestions[0].suggestedText).toMatch(/split|@|reference|separate/i);
    });
  });

  describe('multiple issues', () => {
    it('should generate one suggestion per issue', () => {
      const suggestions = suggestion([
        {
          type: 'vague',
          severity: 'medium',
          description: 'Vague: "Make it work well."',
          location: { lineStart: 1, lineEnd: 1 },
          relatedLines: ['Make it work well.'],
        },
        {
          type: 'missing',
          severity: 'high',
          description: 'Missing commands.',
          location: { lineStart: 0, lineEnd: 0 },
        },
      ]);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].issueIndex).toBe(0);
      expect(suggestions[1].issueIndex).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for no issues', () => {
      const suggestions = suggestion([]);
      expect(suggestions).toHaveLength(0);
    });

    it('should handle issues without relatedLines', () => {
      const suggestions = suggestion([
        {
          type: 'missing',
          severity: 'high',
          description: 'Missing section.',
          location: { lineStart: 0, lineEnd: 0 },
        },
      ]);

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
