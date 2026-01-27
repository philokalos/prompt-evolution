/**
 * Prompt History CRUD Operations
 * PromptLint - Create, Read, Update, Delete operations for prompt analysis history
 */

import { getDatabase } from './connection.js';
import type { PromptHistoryRecord, WeaknessStats } from './types.js';

/**
 * Save a prompt analysis to history
 */
export function saveAnalysis(record: PromptHistoryRecord): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO prompt_history (
      prompt_text, overall_score, grade,
      golden_goal, golden_output, golden_limits,
      golden_data, golden_evaluation, golden_next,
      issues_json, improved_prompt, source_app,
      project_path, intent, category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    record.promptText,
    record.overallScore,
    record.grade,
    record.goldenScores.goal,
    record.goldenScores.output,
    record.goldenScores.limits,
    record.goldenScores.data,
    record.goldenScores.evaluation,
    record.goldenScores.next,
    record.issues ? JSON.stringify(record.issues) : null,
    record.improvedPrompt || null,
    record.sourceApp || null,
    record.projectPath || null,
    record.intent || null,
    record.category || null
  );

  // Update weakness tracking
  if (record.issues) {
    updateWeaknessTracking(record.goldenScores);
  }

  return result.lastInsertRowid as number;
}

/**
 * Get recent analyses
 */
export function getRecentAnalyses(limit = 30): PromptHistoryRecord[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM prompt_history
    ORDER BY analyzed_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    id: number;
    prompt_text: string;
    overall_score: number;
    grade: string;
    golden_goal: number;
    golden_output: number;
    golden_limits: number;
    golden_data: number;
    golden_evaluation: number;
    golden_next: number;
    issues_json: string | null;
    improved_prompt: string | null;
    source_app: string | null;
    analyzed_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    promptText: row.prompt_text,
    overallScore: row.overall_score,
    grade: row.grade as 'A' | 'B' | 'C' | 'D' | 'F',
    goldenScores: {
      goal: row.golden_goal,
      output: row.golden_output,
      limits: row.golden_limits,
      data: row.golden_data,
      evaluation: row.golden_evaluation,
      next: row.golden_next,
    },
    issues: row.issues_json ? JSON.parse(row.issues_json) : [],
    improvedPrompt: row.improved_prompt || undefined,
    sourceApp: row.source_app || undefined,
    analyzedAt: new Date(row.analyzed_at),
  }));
}

/**
 * Get analyses by project path
 */
export function getAnalysesByProject(projectPath: string, limit = 20): PromptHistoryRecord[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM prompt_history
    WHERE project_path = ?
    ORDER BY analyzed_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(projectPath, limit) as Array<{
    id: number;
    prompt_text: string;
    overall_score: number;
    grade: string;
    golden_goal: number;
    golden_output: number;
    golden_limits: number;
    golden_data: number;
    golden_evaluation: number;
    golden_next: number;
    issues_json: string | null;
    improved_prompt: string | null;
    source_app: string | null;
    project_path: string | null;
    intent: string | null;
    category: string | null;
    analyzed_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    promptText: row.prompt_text,
    overallScore: row.overall_score,
    grade: row.grade as 'A' | 'B' | 'C' | 'D' | 'F',
    goldenScores: {
      goal: row.golden_goal,
      output: row.golden_output,
      limits: row.golden_limits,
      data: row.golden_data,
      evaluation: row.golden_evaluation,
      next: row.golden_next,
    },
    issues: row.issues_json ? JSON.parse(row.issues_json) : [],
    improvedPrompt: row.improved_prompt || undefined,
    sourceApp: row.source_app || undefined,
    projectPath: row.project_path || undefined,
    intent: row.intent || undefined,
    category: row.category || undefined,
    analyzedAt: new Date(row.analyzed_at),
  }));
}

/**
 * Get high-scoring prompts from the same project (for reference)
 */
export function getHighScoringPrompts(projectPath: string, minScore = 80, limit = 5): PromptHistoryRecord[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM prompt_history
    WHERE project_path = ? AND overall_score >= ?
    ORDER BY overall_score DESC, analyzed_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(projectPath, minScore, limit) as Array<{
    id: number;
    prompt_text: string;
    overall_score: number;
    grade: string;
    golden_goal: number;
    golden_output: number;
    golden_limits: number;
    golden_data: number;
    golden_evaluation: number;
    golden_next: number;
    issues_json: string | null;
    improved_prompt: string | null;
    source_app: string | null;
    project_path: string | null;
    intent: string | null;
    category: string | null;
    analyzed_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    promptText: row.prompt_text,
    overallScore: row.overall_score,
    grade: row.grade as 'A' | 'B' | 'C' | 'D' | 'F',
    goldenScores: {
      goal: row.golden_goal,
      output: row.golden_output,
      limits: row.golden_limits,
      data: row.golden_data,
      evaluation: row.golden_evaluation,
      next: row.golden_next,
    },
    issues: row.issues_json ? JSON.parse(row.issues_json) : [],
    improvedPrompt: row.improved_prompt || undefined,
    sourceApp: row.source_app || undefined,
    projectPath: row.project_path || undefined,
    intent: row.intent || undefined,
    category: row.category || undefined,
    analyzedAt: new Date(row.analyzed_at),
  }));
}

/**
 * Get similar prompts by category
 */
export function getSimilarPromptsByCategory(
  category: string,
  projectPath?: string,
  limit = 10
): PromptHistoryRecord[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM prompt_history
    WHERE category = ?
  `;
  const params: (string | number)[] = [category];

  if (projectPath) {
    query += ` AND project_path = ?`;
    params.push(projectPath);
  }

  query += ` ORDER BY overall_score DESC, analyzed_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as Array<{
    id: number;
    prompt_text: string;
    overall_score: number;
    grade: string;
    golden_goal: number;
    golden_output: number;
    golden_limits: number;
    golden_data: number;
    golden_evaluation: number;
    golden_next: number;
    issues_json: string | null;
    improved_prompt: string | null;
    source_app: string | null;
    project_path: string | null;
    intent: string | null;
    category: string | null;
    analyzed_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    promptText: row.prompt_text,
    overallScore: row.overall_score,
    grade: row.grade as 'A' | 'B' | 'C' | 'D' | 'F',
    goldenScores: {
      goal: row.golden_goal,
      output: row.golden_output,
      limits: row.golden_limits,
      data: row.golden_data,
      evaluation: row.golden_evaluation,
      next: row.golden_next,
    },
    issues: row.issues_json ? JSON.parse(row.issues_json) : [],
    improvedPrompt: row.improved_prompt || undefined,
    sourceApp: row.source_app || undefined,
    projectPath: row.project_path || undefined,
    intent: row.intent || undefined,
    category: row.category || undefined,
    analyzedAt: new Date(row.analyzed_at),
  }));
}

/**
 * Get top weaknesses based on lowest scoring dimensions
 */
export function getTopWeaknesses(limit = 3): WeaknessStats[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT weakness_type, frequency, last_seen_at
    FROM personal_tips
    ORDER BY frequency DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    weakness_type: string;
    frequency: number;
    last_seen_at: string;
  }>;

  return rows.map(row => ({
    type: row.weakness_type,
    frequency: row.frequency,
    lastSeen: new Date(row.last_seen_at),
  }));
}

/**
 * Update weakness tracking based on low scores
 */
function updateWeaknessTracking(scores: Record<string, number>): void {
  const db = getDatabase();
  const weaknessThreshold = 60;

  const upsertStmt = db.prepare(`
    INSERT INTO personal_tips (weakness_type, frequency, last_seen_at)
    VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(weakness_type) DO UPDATE SET
      frequency = frequency + 1,
      last_seen_at = CURRENT_TIMESTAMP
  `);

  const dimensions: Array<[string, string]> = [
    ['goal', '목표 명확성'],
    ['output', '출력 형식'],
    ['limits', '제약 조건'],
    ['data', '데이터/컨텍스트'],
    ['evaluation', '평가 기준'],
    ['next', '다음 단계'],
  ];

  for (const [key, label] of dimensions) {
    if (scores[key] < weaknessThreshold) {
      upsertStmt.run(label);
    }
  }
}
