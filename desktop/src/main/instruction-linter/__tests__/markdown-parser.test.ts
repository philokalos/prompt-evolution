/**
 * Markdown Section Parser Tests (TDD)
 *
 * Tests for parseMarkdownSections() that splits CLAUDE.md-style
 * files into structured sections with heading, content, code blocks,
 * and @references.
 */

import { describe, it, expect } from 'vitest';
import { parseMarkdownSections } from '../markdown-parser.js';

describe('parseMarkdownSections', () => {
  describe('heading extraction', () => {
    it('should parse top-level headings', () => {
      const input = '# Project\n\nSome content\n\n# Commands\n\nMore content';
      const sections = parseMarkdownSections(input);

      expect(sections).toHaveLength(2);
      expect(sections[0].heading).toBe('Project');
      expect(sections[0].level).toBe(1);
      expect(sections[1].heading).toBe('Commands');
      expect(sections[1].level).toBe(1);
    });

    it('should parse nested headings', () => {
      const input = '# Main\n\n## Sub\n\nContent\n\n### Deep\n\nMore';
      const sections = parseMarkdownSections(input);

      expect(sections).toHaveLength(3);
      expect(sections[0].level).toBe(1);
      expect(sections[1].level).toBe(2);
      expect(sections[2].level).toBe(3);
    });

    it('should handle headings without space after #', () => {
      const input = '#NoSpace\n\nContent';
      const sections = parseMarkdownSections(input);

      // Should still parse as heading (common in quick edits)
      expect(sections.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('content extraction', () => {
    it('should capture content between headings', () => {
      const input = '# Title\n\nParagraph one.\n\nParagraph two.\n\n# Next';
      const sections = parseMarkdownSections(input);

      expect(sections[0].content).toContain('Paragraph one.');
      expect(sections[0].content).toContain('Paragraph two.');
    });

    it('should include line numbers', () => {
      const input = '# First\n\nContent\n\n# Second\n\nMore';
      const sections = parseMarkdownSections(input);

      expect(sections[0].lineStart).toBe(1);
      expect(sections[1].lineStart).toBeGreaterThan(sections[0].lineStart);
    });

    it('should set lineEnd correctly', () => {
      const input = '# A\n\nLine 1\nLine 2\n\n# B\n\nLine 3';
      const sections = parseMarkdownSections(input);

      expect(sections[0].lineEnd).toBeLessThan(sections[1].lineStart);
    });
  });

  describe('code block detection', () => {
    it('should extract fenced code blocks', () => {
      const input = '# Setup\n\n```bash\nnpm install\nnpm run dev\n```\n\nDone.';
      const sections = parseMarkdownSections(input);

      expect(sections[0].codeBlocks).toHaveLength(1);
      expect(sections[0].codeBlocks[0]).toContain('npm install');
    });

    it('should handle multiple code blocks in one section', () => {
      const input = '# Commands\n\n```bash\nnpm test\n```\n\nAlso:\n\n```bash\nnpm build\n```';
      const sections = parseMarkdownSections(input);

      expect(sections[0].codeBlocks).toHaveLength(2);
    });

    it('should handle code blocks without language specifier', () => {
      const input = '# Code\n\n```\nsome code\n```';
      const sections = parseMarkdownSections(input);

      expect(sections[0].codeBlocks).toHaveLength(1);
    });
  });

  describe('@reference detection', () => {
    it('should detect @path references', () => {
      const input = '# Rules\n\n@.claude/rules/security.md\n@.claude/rules/testing.md';
      const sections = parseMarkdownSections(input);

      expect(sections[0].references).toHaveLength(2);
      expect(sections[0].references[0]).toBe('.claude/rules/security.md');
      expect(sections[0].references[1]).toBe('.claude/rules/testing.md');
    });

    it('should ignore @ in email addresses', () => {
      const input = '# Contact\n\nEmail user@example.com for help.';
      const sections = parseMarkdownSections(input);

      expect(sections[0].references).toHaveLength(0);
    });

    it('should detect @ references at start of line', () => {
      const input = '# Config\n\n@src/config.ts\n\nSome text @not-a-ref more text';
      const sections = parseMarkdownSections(input);

      expect(sections[0].references).toContain('src/config.ts');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const sections = parseMarkdownSections('');
      expect(sections).toHaveLength(0);
    });

    it('should handle input with no headings', () => {
      const input = 'Just plain text without any headings.';
      const sections = parseMarkdownSections(input);

      // Should still capture the content in a default section
      expect(sections.length).toBeGreaterThanOrEqual(1);
      expect(sections[0].content).toContain('plain text');
    });

    it('should handle headings inside code blocks (not parse them)', () => {
      const input = '# Real\n\n```\n# Not a heading\n```\n\nText';
      const sections = parseMarkdownSections(input);

      // Should only have 1 section (the real heading)
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('Real');
    });

    it('should handle content before first heading', () => {
      const input = 'Preamble text\n\n# First Heading\n\nContent';
      const sections = parseMarkdownSections(input);

      expect(sections.length).toBeGreaterThanOrEqual(2);
    });
  });
});
