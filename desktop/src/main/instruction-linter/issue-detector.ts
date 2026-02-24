/**
 * Issue Pattern Detector
 *
 * Detects 6 issue types in instruction files:
 *   excessive:  200+ lines → context rot risk
 *   conflict:   contradicting instructions ("always X" + "never X")
 *   duplicate:  repeated/similar instructions
 *   missing:    required sections absent (commands, project description)
 *   vague:      non-specific instructions ("write good code")
 *   security:   API keys, passwords, secrets in plaintext
 */

import type { ParsedSection } from './markdown-parser.js';

// =============================================================================
// Types
// =============================================================================

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'duplicate' | 'conflict' | 'missing' | 'vague' | 'security' | 'excessive';

export interface IssueLocation {
  lineStart: number;
  lineEnd: number;
  section?: string;
}

export interface InstructionIssue {
  severity: IssueSeverity;
  type: IssueType;
  description: string;
  location: IssueLocation;
  suggestion?: string;
  relatedLines?: string[];
}

export interface DetectorInput {
  sections: ParsedSection[];
  fullText: string;
  lineCount: number;
}

// =============================================================================
// Constants
// =============================================================================

const EXCESSIVE_LINE_THRESHOLD = 200;

const VAGUE_PATTERNS = [
  /^write\s+(good|clean|nice|great|proper|quality)\s+(code|software)/i,
  /^make\s+it\s+(work|good|nice|clean|better)\b/i,
  /^keep\s+(things?|it|code)\s+(clean|simple|nice|good|tidy)\b/i,
  /^be\s+(careful|mindful|aware)\b/i,
  /^follow\s+best\s+practices\b/i,
  /^use\s+common\s+sense\b/i,
  /^do\s+(things?|it)\s+(right|properly|well)\b/i,
];

const SECRET_PATTERNS = [
  // API keys with actual values (not placeholders)
  /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?key)\s*[=:]\s*(?!.*\.{3})[a-zA-Z0-9_-]{20,}/i,
  // Anthropic keys
  /sk-ant-api\d+-[a-zA-Z0-9]{20,}/,
  // OpenAI keys
  /sk-[a-zA-Z0-9]{40,}/,
  // Password with actual value
  /(?:password|passwd)\s*[=:]\s*(?!.*\.{3})\S{8,}/i,
  // AWS keys
  /AKIA[0-9A-Z]{16}/,
  // Generic secret with long value
  /secret[_-]?key\s*[=:]\s*(?!.*\.{3})[a-zA-Z0-9]{16,}/i,
];

const PLACEHOLDER_SIGNALS = /\.{3}|your[_-]|<.*>|example|placeholder|xxx|replace.?this|your.?key/i;

const COMMAND_SIGNALS = /\b(npm\s+(run|test|start)|yarn|pnpm|cargo|go\s+(build|test|run)|make|python|pytest|gradle|mvn)\b/i;
const PROJECT_DESC_SIGNALS = /\b(project|app|application|platform|overview|description|about|purpose)\b/i;

// =============================================================================
// Detectors
// =============================================================================

function detectExcessive(input: DetectorInput): InstructionIssue[] {
  if (input.lineCount <= EXCESSIVE_LINE_THRESHOLD) return [];

  return [{
    severity: 'high',
    type: 'excessive',
    description: `File has ${input.lineCount} lines (>${EXCESSIVE_LINE_THRESHOLD}). Long instruction files increase context rot risk — AI models may ignore later sections.`,
    location: { lineStart: 1, lineEnd: input.lineCount },
    suggestion: 'Consider splitting into focused @referenced files or removing redundant sections.',
  }];
}

function detectConflicts(input: DetectorInput): InstructionIssue[] {
  const issues: InstructionIssue[] = [];

  // Extract directive lines: "always X", "never X", "do not X", "must X"
  interface Directive {
    polarity: 'positive' | 'negative';
    subject: string;
    line: string;
    lineNum: number;
    section: string;
  }

  const directives: Directive[] = [];
  const lines = input.fullText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Find which section this line belongs to
    const sectionName = input.sections.find(
      s => i + 1 >= s.lineStart && i + 1 <= s.lineEnd
    )?.heading ?? '';

    // Positive directives — extract core subject (first few key words)
    const posMatch = line.match(/\b(?:always|must)\s+(?:use\s+)?(.{3,40}?)(?:\s+for\b|\s+in\b|\s+when\b|\s+if\b|\.|,|$)/i);
    if (posMatch) {
      directives.push({
        polarity: 'positive',
        subject: normalizeSubject(posMatch[1]),
        line,
        lineNum: i + 1,
        section: sectionName,
      });
    }

    // Negative directives
    const negMatch = line.match(/\b(?:never|do\s+not|don'?t|must\s+not)\s+(?:use\s+)?(.{3,40}?)(?:\s+for\b|\s+in\b|\s+when\b|\s+if\b|\.|,|$)/i);
    if (negMatch) {
      directives.push({
        polarity: 'negative',
        subject: normalizeSubject(negMatch[1]),
        line,
        lineNum: i + 1,
        section: sectionName,
      });
    }
  }

  // Find contradictions: positive + negative with similar subjects
  for (const pos of directives.filter(d => d.polarity === 'positive')) {
    for (const neg of directives.filter(d => d.polarity === 'negative')) {
      if (pos.lineNum === neg.lineNum) continue;
      if (subjectsSimilar(pos.subject, neg.subject)) {
        issues.push({
          severity: 'critical',
          type: 'conflict',
          description: `Contradicting instructions: "${pos.line.trim()}" vs "${neg.line.trim()}"`,
          location: {
            lineStart: Math.min(pos.lineNum, neg.lineNum),
            lineEnd: Math.max(pos.lineNum, neg.lineNum),
            section: pos.section || neg.section,
          },
          relatedLines: [pos.line.trim(), neg.line.trim()],
          suggestion: 'Remove one of the conflicting instructions or clarify the context where each applies.',
        });
      }
    }
  }

  return issues;
}

function detectDuplicates(input: DetectorInput): InstructionIssue[] {
  const issues: InstructionIssue[] = [];

  // Compare meaningful lines across sections
  const sectionLines: Array<{ text: string; section: ParsedSection }> = [];

  for (const s of input.sections) {
    const lines = s.content.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 15); // Skip short lines
    for (const line of lines) {
      sectionLines.push({ text: line, section: s });
    }
  }

  const seen = new Map<string, { section: ParsedSection; text: string }>();

  for (const { text, section: sect } of sectionLines) {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');

    for (const [key, prev] of seen) {
      if (prev.section === sect) continue; // Same section is fine
      if (normalized === key || stringSimilarity(normalized, key) > 0.85) {
        issues.push({
          severity: 'medium',
          type: 'duplicate',
          description: `Duplicate instruction found in "${sect.heading}" and "${prev.section.heading}"`,
          location: {
            lineStart: sect.lineStart,
            lineEnd: sect.lineEnd,
            section: sect.heading,
          },
          relatedLines: [prev.text, text],
          suggestion: 'Consolidate duplicate instructions into a single location.',
        });
      }
    }

    seen.set(normalized, { section: sect, text });
  }

  return issues;
}

function detectMissing(input: DetectorInput): InstructionIssue[] {
  const issues: InstructionIssue[] = [];
  const fullText = input.fullText.toLowerCase();
  const headings = input.sections.map(s => s.heading.toLowerCase());

  // Check for commands/build section
  const hasCommands = COMMAND_SIGNALS.test(input.fullText) ||
    headings.some(h => /command|build|develop|script|quick\s?start|usage/i.test(h)) ||
    input.sections.some(s => s.codeBlocks.length > 0 && COMMAND_SIGNALS.test(s.codeBlocks.join(' ')));

  if (!hasCommands) {
    issues.push({
      severity: 'high',
      type: 'missing',
      description: 'Missing build/test commands section. AI tools need to know how to build and test the project.',
      location: { lineStart: 0, lineEnd: 0 },
      suggestion: 'Add a "Commands" section with build, test, and dev commands.',
    });
  }

  // Check for project description
  const hasProjectDesc = PROJECT_DESC_SIGNALS.test(fullText) ||
    headings.some(h => /overview|about|introduction|project|description/i.test(h));

  if (!hasProjectDesc) {
    issues.push({
      severity: 'high',
      type: 'missing',
      description: 'Missing project description/overview. AI tools perform better with project context.',
      location: { lineStart: 0, lineEnd: 0 },
      suggestion: 'Add a project overview describing what the project does and its tech stack.',
    });
  }

  return issues;
}

function detectVague(input: DetectorInput): InstructionIssue[] {
  const issues: InstructionIssue[] = [];
  const lines = input.fullText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('```')) continue;

    for (const pattern of VAGUE_PATTERNS) {
      if (pattern.test(line)) {
        // Find which section this belongs to
        const sect = input.sections.find(
          s => i + 1 >= s.lineStart && i + 1 <= s.lineEnd
        );

        issues.push({
          severity: 'medium',
          type: 'vague',
          description: `Vague instruction: "${line}". Non-specific instructions are typically ignored by AI tools.`,
          location: {
            lineStart: i + 1,
            lineEnd: i + 1,
            section: sect?.heading,
          },
          relatedLines: [line],
          suggestion: 'Replace with a specific, actionable instruction (e.g., "Use TypeScript strict mode" instead of "Write good code").',
        });
        break; // One match per line
      }
    }
  }

  return issues;
}

function detectSecurity(input: DetectorInput): InstructionIssue[] {
  const issues: InstructionIssue[] = [];
  const lines = input.fullText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Skip if it looks like a placeholder
    if (PLACEHOLDER_SIGNALS.test(line)) continue;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        const sect = input.sections.find(
          s => i + 1 >= s.lineStart && i + 1 <= s.lineEnd
        );

        // Check if this is inside a code block with placeholder
        const isInExampleBlock = input.sections.some(s =>
          s.codeBlocks.some(b => b.includes(line.trim()) && PLACEHOLDER_SIGNALS.test(b))
        );
        if (isInExampleBlock) continue;

        issues.push({
          severity: 'critical',
          type: 'security',
          description: 'Potential secret or API key detected in instruction file. Instruction files are often committed to version control.',
          location: {
            lineStart: i + 1,
            lineEnd: i + 1,
            section: sect?.heading,
          },
          relatedLines: [line.trim()],
          suggestion: 'Use environment variables or .env files for secrets. Reference them with placeholder values (e.g., "API_KEY=your-key-here").',
        });
        break; // One match per line
      }
    }
  }

  return issues;
}

// =============================================================================
// Utility Functions
// =============================================================================

function normalizeSubject(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function subjectsSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) return true;
  // Check word overlap
  const wordsA = new Set(a.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  const minSize = Math.min(wordsA.size, wordsB.size);
  return overlap / minSize >= 0.6;
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Simple token overlap similarity
  const tokensA = new Set(a.split(/\s+/));
  const tokensB = new Set(b.split(/\s+/));

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? overlap / union : 0;
}

// =============================================================================
// Severity ordering
// =============================================================================

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// =============================================================================
// Main Detector
// =============================================================================

export function detectIssues(input: DetectorInput): InstructionIssue[] {
  const issues: InstructionIssue[] = [
    ...detectExcessive(input),
    ...detectConflicts(input),
    ...detectDuplicates(input),
    ...detectMissing(input),
    ...detectVague(input),
    ...detectSecurity(input),
  ];

  // Sort by severity (critical first)
  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return issues;
}
