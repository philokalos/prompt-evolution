/**
 * Instruction Analysis Repository
 * PromptLint - CRUD operations for CLAUDE.md linter analysis results
 */

import type Database from 'better-sqlite3';
import type { LintResult } from '../instruction-linter/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstructionHistoryEntry {
  id: number;
  filePath: string;
  fileFormat: string;
  overallScore: number;
  grade: string;
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  fileSize: number | null;
  lineCount: number | null;
  analyzedAt: string;
}

export interface InstructionAnalysis extends InstructionHistoryEntry {
  issues: LintResult['issues'];
  suggestions: LintResult['suggestions'];
  sections: LintResult['sections'];
  references: LintResult['references'];
}

export interface HistoryOptions {
  limit?: number;
  offset?: number;
  filePath?: string;
}

// ---------------------------------------------------------------------------
// Row types (from SQLite)
// ---------------------------------------------------------------------------

interface InstructionRow {
  id: number;
  file_path: string;
  file_format: string;
  overall_score: number;
  grade: string;
  golden_goal: number;
  golden_output: number;
  golden_limits: number;
  golden_data: number;
  golden_evaluation: number;
  golden_next: number;
  issues_json: string | null;
  suggestions_json: string | null;
  sections_json: string | null;
  references_json: string | null;
  file_size: number | null;
  line_count: number | null;
  analyzed_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToHistoryEntry(row: InstructionRow): InstructionHistoryEntry {
  return {
    id: row.id,
    filePath: row.file_path,
    fileFormat: row.file_format,
    overallScore: row.overall_score,
    grade: row.grade,
    goldenScores: {
      goal: row.golden_goal,
      output: row.golden_output,
      limits: row.golden_limits,
      data: row.golden_data,
      evaluation: row.golden_evaluation,
      next: row.golden_next,
    },
    fileSize: row.file_size,
    lineCount: row.line_count,
    analyzedAt: row.analyzed_at,
  };
}

function rowToAnalysis(row: InstructionRow): InstructionAnalysis {
  return {
    ...rowToHistoryEntry(row),
    issues: row.issues_json ? JSON.parse(row.issues_json) : [],
    suggestions: row.suggestions_json ? JSON.parse(row.suggestions_json) : [],
    sections: row.sections_json ? JSON.parse(row.sections_json) : [],
    references: row.references_json ? JSON.parse(row.references_json) : [],
  };
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Save an instruction analysis to the database.
 * JSON-stringifies issues, suggestions, sections, references.
 * Returns the new row ID.
 */
export function saveAnalysis(db: Database.Database, analysis: LintResult): number {
  const stmt = db.prepare(`
    INSERT INTO instruction_analysis (
      file_path, file_format, overall_score, grade,
      golden_goal, golden_output, golden_limits,
      golden_data, golden_evaluation, golden_next,
      issues_json, suggestions_json, sections_json, references_json,
      file_size, line_count, analyzed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    analysis.filePath,
    analysis.fileFormat,
    analysis.overallScore,
    analysis.grade,
    analysis.goldenScores.goal,
    analysis.goldenScores.output,
    analysis.goldenScores.limits,
    analysis.goldenScores.data,
    analysis.goldenScores.evaluation,
    analysis.goldenScores.next,
    analysis.issues.length > 0 ? JSON.stringify(analysis.issues) : null,
    analysis.suggestions.length > 0 ? JSON.stringify(analysis.suggestions) : null,
    analysis.sections.length > 0 ? JSON.stringify(analysis.sections) : null,
    analysis.references.length > 0 ? JSON.stringify(analysis.references) : null,
    analysis.fileSize ?? null,
    analysis.lineCount ?? null,
    analysis.analyzedAt ?? new Date().toISOString(),
  );

  return result.lastInsertRowid as number;
}

/**
 * Get paginated analysis history, ordered by date descending.
 * Optionally filter by filePath.
 */
export function getHistory(
  db: Database.Database,
  opts?: HistoryOptions,
): InstructionHistoryEntry[] {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  if (opts?.filePath) {
    const stmt = db.prepare(`
      SELECT * FROM instruction_analysis
      WHERE file_path = ?
      ORDER BY analyzed_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(opts.filePath, limit, offset) as InstructionRow[];
    return rows.map(rowToHistoryEntry);
  }

  const stmt = db.prepare(`
    SELECT * FROM instruction_analysis
    ORDER BY analyzed_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(limit, offset) as InstructionRow[];
  return rows.map(rowToHistoryEntry);
}

/**
 * Get the most recent full analysis for a given file path.
 * Returns null if no analysis exists.
 */
export function getLatestForFile(
  db: Database.Database,
  filePath: string,
): InstructionAnalysis | null {
  const stmt = db.prepare(`
    SELECT * FROM instruction_analysis
    WHERE file_path = ?
    ORDER BY analyzed_at DESC
    LIMIT 1
  `);
  const row = stmt.get(filePath) as InstructionRow | undefined;
  return row ? rowToAnalysis(row) : null;
}
