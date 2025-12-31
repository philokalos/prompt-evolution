/**
 * Prompt History Repository
 * PromptLint - CRUD operations for prompt analysis history
 */

import { getDatabase } from './connection.js';

export interface PromptHistoryRecord {
  id?: number;
  promptText: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues?: Array<{
    severity: 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
  }>;
  improvedPrompt?: string;
  sourceApp?: string;
  analyzedAt?: Date;
}

export interface ProgressSnapshot {
  period: 'daily' | 'weekly' | 'monthly';
  averageScore: number;
  totalAnalyses: number;
  topWeaknesses: string[];
  scoreDistribution: Record<string, number>;
  snapshotDate: string;
}

export interface WeaknessStats {
  type: string;
  frequency: number;
  lastSeen: Date;
}

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
      issues_json, improved_prompt, source_app
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    record.sourceApp || null
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
 * Get score trend over time
 */
export function getScoreTrend(days = 30): Array<{ date: string; avgScore: number; count: number }> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      DATE(analyzed_at) as date,
      AVG(overall_score) as avg_score,
      COUNT(*) as count
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(analyzed_at)
    ORDER BY date ASC
  `);

  const rows = stmt.all(days) as Array<{
    date: string;
    avg_score: number;
    count: number;
  }>;

  return rows.map(row => ({
    date: row.date,
    avgScore: Math.round(row.avg_score),
    count: row.count,
  }));
}

/**
 * Get GOLDEN dimension averages
 */
export function getGoldenAverages(days = 30): Record<string, number> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      AVG(golden_goal) as goal,
      AVG(golden_output) as output,
      AVG(golden_limits) as limits,
      AVG(golden_data) as data,
      AVG(golden_evaluation) as evaluation,
      AVG(golden_next) as next
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-' || ? || ' days')
  `);

  const row = stmt.get(days) as {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };

  return {
    goal: Math.round(row.goal || 0),
    output: Math.round(row.output || 0),
    limits: Math.round(row.limits || 0),
    data: Math.round(row.data || 0),
    evaluation: Math.round(row.evaluation || 0),
    next: Math.round(row.next || 0),
  };
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

/**
 * Get statistics summary
 */
export function getStats(): {
  totalAnalyses: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  recentTrend: 'improving' | 'stable' | 'declining';
} {
  const db = getDatabase();

  // Total and average
  const statsStmt = db.prepare(`
    SELECT COUNT(*) as total, AVG(overall_score) as avg
    FROM prompt_history
  `);
  const stats = statsStmt.get() as { total: number; avg: number };

  // Grade distribution
  const gradeStmt = db.prepare(`
    SELECT grade, COUNT(*) as count
    FROM prompt_history
    GROUP BY grade
  `);
  const grades = gradeStmt.all() as Array<{ grade: string; count: number }>;
  const gradeDistribution: Record<string, number> = {};
  for (const g of grades) {
    gradeDistribution[g.grade] = g.count;
  }

  // Recent trend (compare last 7 days vs previous 7 days)
  const trendStmt = db.prepare(`
    SELECT
      (SELECT AVG(overall_score) FROM prompt_history WHERE analyzed_at >= DATE('now', '-7 days')) as recent,
      (SELECT AVG(overall_score) FROM prompt_history WHERE analyzed_at >= DATE('now', '-14 days') AND analyzed_at < DATE('now', '-7 days')) as previous
  `);
  const trend = trendStmt.get() as { recent: number; previous: number };

  let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (trend.recent && trend.previous) {
    const diff = trend.recent - trend.previous;
    if (diff > 5) recentTrend = 'improving';
    else if (diff < -5) recentTrend = 'declining';
  }

  return {
    totalAnalyses: stats.total || 0,
    averageScore: Math.round(stats.avg || 0),
    gradeDistribution,
    recentTrend,
  };
}
