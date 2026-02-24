/**
 * Issue Detector Tests (TDD)
 *
 * Tests for detectIssues() that finds 6 issue types:
 *   excessive:  200+ lines → context rot warning
 *   conflict:   "always X" + "never X" contradictions
 *   duplicate:  similar/repeated instructions
 *   missing:    required sections absent
 *   vague:      non-specific instructions
 *   security:   API keys, passwords in plaintext
 */

import { describe, it, expect } from 'vitest';
import { detectIssues } from '../issue-detector.js';
import type { ParsedSection } from '../markdown-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(heading: string, content: string, opts?: {
  level?: number;
  lineStart?: number;
  lineEnd?: number;
  codeBlocks?: string[];
}): ParsedSection {
  const lines = content.split('\n');
  return {
    heading,
    level: opts?.level ?? 1,
    content,
    lineStart: opts?.lineStart ?? 1,
    lineEnd: opts?.lineEnd ?? lines.length,
    codeBlocks: opts?.codeBlocks ?? [],
    references: [],
  };
}

function detect(sections: ParsedSection[], fullText?: string, lineCount?: number) {
  const text = fullText ?? sections.map(s => `# ${s.heading}\n${s.content}`).join('\n\n');
  return detectIssues({
    sections,
    fullText: text,
    lineCount: lineCount ?? text.split('\n').length,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectIssues', () => {
  describe('excessive (200+ lines)', () => {
    it('should flag files over 200 lines', () => {
      const longContent = Array(250).fill('Some instruction line.').join('\n');
      const sections = [section('Rules', longContent, { lineEnd: 250 })];
      const issues = detect(sections, longContent, 250);

      const excessive = issues.filter(i => i.type === 'excessive');
      expect(excessive.length).toBeGreaterThanOrEqual(1);
      expect(excessive[0].severity).toBe('high');
    });

    it('should not flag files under 200 lines', () => {
      const shortContent = Array(50).fill('Rule.').join('\n');
      const sections = [section('Rules', shortContent, { lineEnd: 50 })];
      const issues = detect(sections, shortContent, 50);

      const excessive = issues.filter(i => i.type === 'excessive');
      expect(excessive).toHaveLength(0);
    });

    it('should include context rot warning in description', () => {
      const longContent = Array(300).fill('Line.').join('\n');
      const sections = [section('Rules', longContent, { lineEnd: 300 })];
      const issues = detect(sections, longContent, 300);

      const excessive = issues.filter(i => i.type === 'excessive');
      expect(excessive[0].description).toMatch(/context|rot|long|excessive/i);
    });
  });

  describe('conflict ("always X" + "never X")', () => {
    it('should detect "always" + "never" contradictions', () => {
      const sections = [
        section('Rules', 'Always use semicolons.\nCode must be clean.', { lineStart: 1, lineEnd: 2 }),
        section('Style', 'Never use semicolons.\nKeep it simple.', { lineStart: 4, lineEnd: 5 }),
      ];
      const issues = detect(sections);

      const conflicts = issues.filter(i => i.type === 'conflict');
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(conflicts[0].severity).toBe('critical');
    });

    it('should detect "do not" + "must" contradictions on same topic', () => {
      const sections = [
        section('Rules', 'Do not use any type.\nMust use any for legacy code.', { lineStart: 1, lineEnd: 2 }),
      ];
      const issues = detect(sections);

      const conflicts = issues.filter(i => i.type === 'conflict');
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
    });

    it('should not flag unrelated always/never pairs', () => {
      const sections = [
        section('Rules', 'Always use TypeScript.\nNever commit secrets.'),
      ];
      const issues = detect(sections);

      const conflicts = issues.filter(i => i.type === 'conflict');
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('duplicate (similar instructions)', () => {
    it('should detect highly similar lines', () => {
      const sections = [
        section('Rules', 'Always use strict TypeScript mode.', { lineStart: 1, lineEnd: 1 }),
        section('Style', 'Always use strict TypeScript mode.', { lineStart: 3, lineEnd: 3 }),
      ];
      const issues = detect(sections);

      const duplicates = issues.filter(i => i.type === 'duplicate');
      expect(duplicates.length).toBeGreaterThanOrEqual(1);
      expect(duplicates[0].severity).toBe('medium');
    });

    it('should not flag clearly different content', () => {
      const sections = [
        section('Build', 'npm run build compiles TypeScript.'),
        section('Test', 'npm test runs Vitest unit tests.'),
      ];
      const issues = detect(sections);

      const duplicates = issues.filter(i => i.type === 'duplicate');
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('missing (required sections absent)', () => {
    it('should flag when no build/test commands exist', () => {
      const sections = [
        section('About', 'This is a project.'),
      ];
      const issues = detect(sections);

      const missing = issues.filter(i => i.type === 'missing');
      expect(missing.length).toBeGreaterThanOrEqual(1);
    });

    it('should not flag when commands section exists', () => {
      const sections = [
        section('Commands', 'npm run build\nnpm test', { codeBlocks: ['npm run build'] }),
        section('About', 'React app.'),
      ];
      const issues = detect(sections);

      const missing = issues.filter(i => i.type === 'missing' && /command|build|test/i.test(i.description));
      expect(missing).toHaveLength(0);
    });

    it('should flag when no project description exists', () => {
      const sections = [
        section('Commands', 'npm run build\nnpm test', { codeBlocks: ['npm run build'] }),
      ];
      const issues = detect(sections);

      const missing = issues.filter(i => i.type === 'missing' && /project|description|overview/i.test(i.description));
      expect(missing.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('vague (non-specific instructions)', () => {
    it('should detect vague instructions', () => {
      const sections = [
        section('Rules', 'Write good code.\nMake it work well.\nKeep things clean.'),
      ];
      const issues = detect(sections);

      const vague = issues.filter(i => i.type === 'vague');
      expect(vague.length).toBeGreaterThanOrEqual(1);
      expect(vague[0].severity).toBe('medium');
    });

    it('should not flag specific instructions', () => {
      const sections = [
        section('Rules', 'Use TypeScript strict mode.\nAll functions must have explicit return types.\nUse camelCase for variables.'),
      ];
      const issues = detect(sections);

      const vague = issues.filter(i => i.type === 'vague');
      expect(vague).toHaveLength(0);
    });
  });

  describe('security (API keys / passwords)', () => {
    it('should detect API key patterns in content', () => {
      const sections = [
        section('Config', 'API_KEY=sk-ant-api03-abcdefghij1234567890abcdefghij\nDATABASE_URL=postgres://user:pass@host'),
      ];
      const issues = detect(sections);

      const security = issues.filter(i => i.type === 'security');
      expect(security.length).toBeGreaterThanOrEqual(1);
      expect(security[0].severity).toBe('critical');
    });

    it('should detect password/secret patterns', () => {
      const sections = [
        section('Auth', 'password: my-secret-password-123\nSECRET_KEY=abcdefgh'),
      ];
      const issues = detect(sections);

      const security = issues.filter(i => i.type === 'security');
      expect(security.length).toBeGreaterThanOrEqual(1);
    });

    it('should not flag placeholder/example patterns', () => {
      const sections = [
        section('Env', 'API_KEY=your-api-key-here\nDATABASE_URL=postgres://...'),
      ];
      const issues = detect(sections);

      const security = issues.filter(i => i.type === 'security');
      expect(security).toHaveLength(0);
    });

    it('should not flag keys inside code blocks that are clearly examples', () => {
      const sections = [
        section('Setup', 'Set your env vars:', {
          codeBlocks: ['export ANTHROPIC_API_KEY=sk-ant-...'],
        }),
      ];
      const issues = detect(sections);

      const security = issues.filter(i => i.type === 'security');
      expect(security).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const issues = detect([], '', 0);
      // Should still flag missing sections
      const nonMissing = issues.filter(i => i.type !== 'missing');
      expect(nonMissing).toHaveLength(0);
    });

    it('should include location info for each issue', () => {
      const sections = [
        section('Rules', 'Write good code.', { lineStart: 1, lineEnd: 2 }),
      ];
      const issues = detect(sections);

      for (const issue of issues) {
        expect(issue.location).toBeDefined();
        expect(issue.location.lineStart).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return issues sorted by severity (critical first)', () => {
      const content = 'Always use tabs.\nNever use tabs.\nAPI_KEY=sk-live-realkey123456789\nWrite good code.';
      const sections = [
        section('Rules', content, { lineStart: 1, lineEnd: 4 }),
      ];
      const issues = detect(sections);

      if (issues.length >= 2) {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < issues.length; i++) {
          expect(severityOrder[issues[i].severity]).toBeGreaterThanOrEqual(
            severityOrder[issues[i - 1].severity]
          );
        }
      }
    });
  });
});
