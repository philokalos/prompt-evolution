/**
 * Lightweight Markdown Section Parser
 *
 * Parses CLAUDE.md-style files into structured sections.
 * Extracts headings, content, code blocks, and @references.
 */

export interface ParsedSection {
  heading: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
  codeBlocks: string[];
  references: string[];
}

const HEADING_RE = /^(#{1,6})\s*(.*)/;
const FENCE_RE = /^```/;
const REF_RE = /^@([^\s@]+\.[^\s@]+)/;

/**
 * Parse markdown text into sections.
 * Handles headings, code blocks (skipping headings inside them),
 * and @path references (ignoring emails).
 */
export function parseMarkdownSections(text: string): ParsedSection[] {
  if (!text.trim()) return [];

  const lines = text.split('\n');
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  function finalizeCurrent(endLine: number): void {
    if (current) {
      current.lineEnd = endLine;
      current.content = current.content.trimEnd();
      sections.push(current);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-based

    // Toggle code block state
    if (FENCE_RE.test(line.trimStart())) {
      if (inCodeBlock) {
        // End of code block
        inCodeBlock = false;
        if (current) {
          current.codeBlocks.push(codeBlockContent.join('\n'));
        }
        codeBlockContent = [];
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockContent = [];
      }
      if (current) {
        current.content += line + '\n';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      if (current) {
        current.content += line + '\n';
      }
      continue;
    }

    // Check for heading
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      finalizeCurrent(lineNum - 1);
      current = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: '',
        lineStart: lineNum,
        lineEnd: lineNum,
        codeBlocks: [],
        references: [],
      };
      continue;
    }

    // Check for @reference (at start of line, not email)
    const refMatch = line.trimStart().match(REF_RE);
    if (refMatch && current) {
      current.references.push(refMatch[1]);
    }

    // Accumulate content
    if (current) {
      current.content += line + '\n';
    } else {
      // Content before first heading — create a preamble section
      current = {
        heading: '',
        level: 0,
        content: line + '\n',
        lineStart: lineNum,
        lineEnd: lineNum,
        codeBlocks: [],
        references: [],
      };
    }
  }

  // Finalize last section
  finalizeCurrent(lines.length);

  return sections;
}
