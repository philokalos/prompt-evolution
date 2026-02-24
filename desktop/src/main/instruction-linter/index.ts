/**
 * Instruction Linter — Barrel Entrypoint
 *
 * Orchestrates the full linting pipeline:
 *   1. Read file → parse markdown sections
 *   2. Resolve @references
 *   3. Evaluate GOLDEN dimensions
 *   4. Detect issues
 *   5. Generate suggestions
 *   6. Return InstructionAnalysis result
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdownSections } from './markdown-parser.js';
import { resolveReferences } from './reference-resolver.js';
import { evaluateInstructions } from './instruction-evaluator.js';
import { detectIssues } from './issue-detector.js';
import { generateSuggestions } from './suggestion-generator.js';

// Re-export submodules
export { parseMarkdownSections } from './markdown-parser.js';
export type { ParsedSection } from './markdown-parser.js';
export { resolveReferences } from './reference-resolver.js';
export type { ResolvedReference } from './reference-resolver.js';
export { evaluateInstructions, calculateGrade } from './instruction-evaluator.js';
export type { EvaluatorInput, EvaluatorResult } from './instruction-evaluator.js';
export { detectIssues } from './issue-detector.js';
export type { InstructionIssue, DetectorInput, IssueType, IssueSeverity } from './issue-detector.js';
export { generateSuggestions } from './suggestion-generator.js';
export type { InstructionSuggestion, SuggestionType } from './suggestion-generator.js';

// =============================================================================
// Types
// =============================================================================

type InstructionFileFormat = 'claude-md' | 'cursorrules' | 'copilot-instructions';
type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface LintResult {
  filePath: string;
  fileFormat: InstructionFileFormat;
  overallScore: number;
  grade: Grade;
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
    total: number;
  };
  issues: Array<{
    severity: string;
    type: string;
    description: string;
    location: { lineStart: number; lineEnd: number; section?: string };
    suggestion?: string;
    relatedLines?: string[];
  }>;
  suggestions: Array<{
    issueIndex: number;
    type: string;
    originalText?: string;
    suggestedText: string;
    description: string;
  }>;
  sections: Array<{
    heading: string;
    level: number;
    content: string;
    lineStart: number;
    lineEnd: number;
    codeBlocks: string[];
    references: string[];
  }>;
  references: Array<{
    path: string;
    resolvedPath?: string;
    exists: boolean;
    content?: string;
    lineCount?: number;
  }>;
  fileSize: number;
  lineCount: number;
  analyzedAt: string;
}

// =============================================================================
// File Format Detection
// =============================================================================

function detectFileFormat(filePath: string): InstructionFileFormat {
  const basename = path.basename(filePath).toLowerCase();

  if (basename === 'claude.md' || basename === '.claude.md') return 'claude-md';
  if (basename === '.cursorrules' || basename === 'cursorrules') return 'cursorrules';
  if (basename === 'copilot-instructions.md') return 'copilot-instructions';

  // Fallback: check path patterns
  if (filePath.includes('.github/copilot')) return 'copilot-instructions';
  if (filePath.includes('.cursor')) return 'cursorrules';

  return 'claude-md'; // Default
}

// =============================================================================
// Constants
// =============================================================================

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.wasm', '.bin',
]);

const CONTEXT_ROT_LINE_THRESHOLD = 10_000;

// =============================================================================
// Main Pipeline
// =============================================================================

/**
 * Lint an instruction file through the full pipeline.
 * Returns a complete analysis result.
 */
export function lintInstructionFile(filePath: string): LintResult {
  const absolutePath = path.resolve(filePath);

  // Edge case: Binary file check (before reading content)
  const ext = path.extname(absolutePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    throw new Error('Binary files cannot be analyzed');
  }

  // Edge case: Permission/not-found errors
  let content: string;
  let stats: fs.Stats;
  try {
    content = fs.readFileSync(absolutePath, 'utf-8');
    stats = fs.statSync(absolutePath);
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      const fsErr = err as NodeJS.ErrnoException;
      if (fsErr.code === 'ENOENT') {
        throw new Error(`File not found: ${absolutePath}`);
      }
      if (fsErr.code === 'EACCES') {
        throw new Error(`Permission denied: ${absolutePath}`);
      }
    }
    throw err;
  }

  // Edge case: Empty file
  if (content.trim().length === 0) {
    return {
      filePath: absolutePath,
      fileFormat: detectFileFormat(absolutePath),
      overallScore: 0,
      grade: 'F',
      goldenScores: {
        goal: 0,
        output: 0,
        limits: 0,
        data: 0,
        evaluation: 0,
        next: 0,
        total: 0,
      },
      issues: [{
        severity: 'critical',
        type: 'missing',
        description: 'File is empty',
        location: { lineStart: 0, lineEnd: 0 },
        suggestion: 'Add project description, commands, coding conventions, and constraints.',
      }],
      suggestions: [{
        issueIndex: 0,
        type: 'add',
        suggestedText: '# Project Name\n\nDescribe your project here.\n\n## Commands\n\n```bash\nnpm run dev\nnpm test\n```',
        description: 'Add initial content with project description and commands.',
      }],
      sections: [],
      references: [],
      fileSize: stats.size,
      lineCount: 0,
      analyzedAt: new Date().toISOString(),
    };
  }

  const lines = content.split('\n');

  // 1. Parse markdown sections
  const sections = parseMarkdownSections(content);

  // 2. Resolve @references
  const allRefs = sections.flatMap(s => s.references);
  const basePath = path.dirname(absolutePath);
  const references = resolveReferences(allRefs, basePath);

  // 3. Evaluate GOLDEN dimensions
  const evaluation = evaluateInstructions({
    sections,
    fullText: content,
    lineCount: lines.length,
  });

  // 4. Detect issues
  const issues = detectIssues({
    sections,
    fullText: content,
    lineCount: lines.length,
  });

  // Edge case: Large file context rot warning
  if (lines.length > CONTEXT_ROT_LINE_THRESHOLD) {
    issues.push({
      severity: 'high',
      type: 'excessive',
      description: `File has ${lines.length} lines (>${CONTEXT_ROT_LINE_THRESHOLD}). Extremely large instruction files cause context rot — AI models will lose track of earlier instructions.`,
      location: { lineStart: 1, lineEnd: lines.length },
      suggestion: 'Aggressively split into focused @referenced files. Keep the root file under 500 lines as an index/overview.',
    });
  }

  // 5. Generate suggestions
  const suggestions = generateSuggestions({ issues });

  // 6. Assemble result
  return {
    filePath: absolutePath,
    fileFormat: detectFileFormat(absolutePath),
    overallScore: evaluation.overallScore,
    grade: evaluation.grade,
    goldenScores: evaluation.goldenScores,
    issues,
    suggestions,
    sections,
    references,
    fileSize: stats.size,
    lineCount: lines.length,
    analyzedAt: new Date().toISOString(),
  };
}
