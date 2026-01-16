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
  projectPath?: string;
  intent?: string;
  category?: string;
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
 * Get weekly statistics
 */
export function getWeeklyStats(weeks = 4): Array<{
  weekStart: string;
  avgScore: number;
  count: number;
  improvement: number;
}> {
  const db = getDatabase();

  const stmt = db.prepare(`
    WITH weekly_data AS (
      SELECT
        DATE(analyzed_at, 'weekday 0', '-6 days') as week_start,
        AVG(overall_score) as avg_score,
        COUNT(*) as count
      FROM prompt_history
      WHERE analyzed_at >= DATE('now', '-' || ? || ' weeks')
      GROUP BY week_start
      ORDER BY week_start ASC
    )
    SELECT
      week_start,
      avg_score,
      count,
      avg_score - LAG(avg_score) OVER (ORDER BY week_start) as improvement
    FROM weekly_data
  `);

  const rows = stmt.all(weeks * 7) as Array<{
    week_start: string;
    avg_score: number;
    count: number;
    improvement: number | null;
  }>;

  return rows.map(row => ({
    weekStart: row.week_start,
    avgScore: Math.round(row.avg_score),
    count: row.count,
    improvement: Math.round(row.improvement || 0),
  }));
}

/**
 * Get monthly statistics
 */
export function getMonthlyStats(months = 6): Array<{
  month: string;
  avgScore: number;
  count: number;
  gradeDistribution: Record<string, number>;
}> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m', analyzed_at) as month,
      AVG(overall_score) as avg_score,
      COUNT(*) as count
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-' || ? || ' months')
    GROUP BY month
    ORDER BY month ASC
  `);

  const rows = stmt.all(months) as Array<{
    month: string;
    avg_score: number;
    count: number;
  }>;

  // Get grade distribution per month
  const gradeStmt = db.prepare(`
    SELECT
      strftime('%Y-%m', analyzed_at) as month,
      grade,
      COUNT(*) as count
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-' || ? || ' months')
    GROUP BY month, grade
  `);

  const gradeRows = gradeStmt.all(months) as Array<{
    month: string;
    grade: string;
    count: number;
  }>;

  const gradesByMonth: Record<string, Record<string, number>> = {};
  for (const row of gradeRows) {
    if (!gradesByMonth[row.month]) {
      gradesByMonth[row.month] = {};
    }
    gradesByMonth[row.month][row.grade] = row.count;
  }

  return rows.map(row => ({
    month: row.month,
    avgScore: Math.round(row.avg_score),
    count: row.count,
    gradeDistribution: gradesByMonth[row.month] || {},
  }));
}

/**
 * Get improvement analysis
 */
export function getImprovementAnalysis(): {
  overallImprovement: number;
  bestDimension: string;
  worstDimension: string;
  streak: number;
  milestones: Array<{ type: string; date: string; value: number }>;
} {
  const db = getDatabase();

  // Compare first week vs last week averages
  const improvementStmt = db.prepare(`
    WITH first_week AS (
      SELECT AVG(overall_score) as avg
      FROM prompt_history
      WHERE analyzed_at <= DATE('now', '-21 days')
      AND analyzed_at >= DATE('now', '-28 days')
    ),
    last_week AS (
      SELECT AVG(overall_score) as avg
      FROM prompt_history
      WHERE analyzed_at >= DATE('now', '-7 days')
    )
    SELECT
      (SELECT avg FROM last_week) - (SELECT avg FROM first_week) as improvement
  `);
  const improvement = improvementStmt.get() as { improvement: number | null };

  // Best/worst dimensions
  const dimensionStmt = db.prepare(`
    SELECT
      AVG(golden_goal) as goal,
      AVG(golden_output) as output,
      AVG(golden_limits) as limits,
      AVG(golden_data) as data,
      AVG(golden_evaluation) as evaluation,
      AVG(golden_next) as next
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-30 days')
  `);
  const dimensions = dimensionStmt.get() as Record<string, number>;

  const dimensionEntries = Object.entries(dimensions).filter(([, v]) => v != null);
  const bestDimension = dimensionEntries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  const worstDimension = dimensionEntries.reduce((a, b) => (a[1] < b[1] ? a : b))[0];

  // Current streak (consecutive days with analyses)
  const streakStmt = db.prepare(`
    WITH RECURSIVE dates AS (
      SELECT DATE('now') as d, 0 as streak
      UNION ALL
      SELECT DATE(d, '-1 day'), streak + 1
      FROM dates
      WHERE EXISTS (
        SELECT 1 FROM prompt_history
        WHERE DATE(analyzed_at) = DATE(d, '-1 day')
      )
      AND streak < 100
    )
    SELECT MAX(streak) as streak FROM dates
  `);
  const streakResult = streakStmt.get() as { streak: number };

  // Milestones (first A grade, highest score, etc)
  const milestones: Array<{ type: string; date: string; value: number }> = [];

  const firstAStmt = db.prepare(`
    SELECT DATE(analyzed_at) as date, overall_score as value
    FROM prompt_history
    WHERE grade = 'A'
    ORDER BY analyzed_at ASC
    LIMIT 1
  `);
  const firstA = firstAStmt.get() as { date: string; value: number } | undefined;
  if (firstA) {
    milestones.push({ type: 'first_a_grade', date: firstA.date, value: firstA.value });
  }

  const highestScoreStmt = db.prepare(`
    SELECT DATE(analyzed_at) as date, MAX(overall_score) as value
    FROM prompt_history
  `);
  const highestScore = highestScoreStmt.get() as { date: string; value: number };
  if (highestScore.value) {
    milestones.push({ type: 'highest_score', date: highestScore.date, value: highestScore.value });
  }

  return {
    overallImprovement: Math.round(improvement.improvement || 0),
    bestDimension,
    worstDimension,
    streak: streakResult.streak || 0,
    milestones,
  };
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
 * Get project-specific GOLDEN averages
 */
export function getProjectGoldenAverages(projectPath: string): Record<string, number> | null {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      AVG(golden_goal) as goal,
      AVG(golden_output) as output,
      AVG(golden_limits) as limits,
      AVG(golden_data) as data,
      AVG(golden_evaluation) as evaluation,
      AVG(golden_next) as next,
      COUNT(*) as count
    FROM prompt_history
    WHERE project_path = ?
  `);

  const row = stmt.get(projectPath) as {
    goal: number | null;
    output: number | null;
    limits: number | null;
    data: number | null;
    evaluation: number | null;
    next: number | null;
    count: number;
  };

  if (!row.count || row.count === 0) return null;

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
 * Get common weaknesses for a project
 */
export function getProjectWeaknesses(projectPath: string): Array<{
  dimension: string;
  averageScore: number;
  belowThresholdCount: number;
}> {
  const db = getDatabase();
  const weaknessThreshold = 60;

  const stmt = db.prepare(`
    SELECT
      AVG(golden_goal) as goal,
      AVG(golden_output) as output,
      AVG(golden_limits) as limits,
      AVG(golden_data) as data,
      AVG(golden_evaluation) as evaluation,
      AVG(golden_next) as next,
      SUM(CASE WHEN golden_goal < ? THEN 1 ELSE 0 END) as goal_weak,
      SUM(CASE WHEN golden_output < ? THEN 1 ELSE 0 END) as output_weak,
      SUM(CASE WHEN golden_limits < ? THEN 1 ELSE 0 END) as limits_weak,
      SUM(CASE WHEN golden_data < ? THEN 1 ELSE 0 END) as data_weak,
      SUM(CASE WHEN golden_evaluation < ? THEN 1 ELSE 0 END) as eval_weak,
      SUM(CASE WHEN golden_next < ? THEN 1 ELSE 0 END) as next_weak
    FROM prompt_history
    WHERE project_path = ?
  `);

  const row = stmt.get(
    weaknessThreshold, weaknessThreshold, weaknessThreshold,
    weaknessThreshold, weaknessThreshold, weaknessThreshold,
    projectPath
  ) as Record<string, number>;

  const dimensions = [
    { key: 'goal', label: '목표 명확성', avg: row.goal, weak: row.goal_weak },
    { key: 'output', label: '출력 형식', avg: row.output, weak: row.output_weak },
    { key: 'limits', label: '제약 조건', avg: row.limits, weak: row.limits_weak },
    { key: 'data', label: '데이터/컨텍스트', avg: row.data, weak: row.data_weak },
    { key: 'evaluation', label: '평가 기준', avg: row.evaluation, weak: row.eval_weak },
    { key: 'next', label: '다음 단계', avg: row.next, weak: row.next_weak },
  ];

  return dimensions
    .filter(d => d.weak > 0)
    .sort((a, b) => b.weak - a.weak)
    .map(d => ({
      dimension: d.label,
      averageScore: Math.round(d.avg || 0),
      belowThresholdCount: d.weak,
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

/**
 * Phase 3: Get issue patterns (frequency and trend analysis)
 */
export interface IssuePattern {
  category: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  recentCount: number; // last 7 days
  trend: 'improving' | 'stable' | 'worsening';
  lastSeen: Date;
}

export function getIssuePatterns(days = 30): IssuePattern[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      issues_json,
      analyzed_at,
      CASE WHEN analyzed_at >= DATE('now', '-7 days') THEN 1 ELSE 0 END as is_recent
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-' || ? || ' days')
      AND issues_json IS NOT NULL
      AND issues_json != '[]'
  `);

  const rows = stmt.all(days) as Array<{
    issues_json: string;
    analyzed_at: string;
    is_recent: number;
  }>;

  // Aggregate issue patterns
  const patternMap = new Map<string, {
    severity: 'high' | 'medium' | 'low';
    count: number;
    recentCount: number;
    lastSeen: Date;
    olderCount: number;
  }>();

  for (const row of rows) {
    const issues = JSON.parse(row.issues_json) as Array<{
      severity: 'high' | 'medium' | 'low';
      category: string;
    }>;

    for (const issue of issues) {
      const key = issue.category;
      const existing = patternMap.get(key);

      if (existing) {
        existing.count++;
        if (row.is_recent) {
          existing.recentCount++;
        } else {
          existing.olderCount++;
        }
        const issueDate = new Date(row.analyzed_at);
        if (issueDate > existing.lastSeen) {
          existing.lastSeen = issueDate;
          existing.severity = issue.severity; // Use most recent severity
        }
      } else {
        patternMap.set(key, {
          severity: issue.severity,
          count: 1,
          recentCount: row.is_recent ? 1 : 0,
          olderCount: row.is_recent ? 0 : 1,
          lastSeen: new Date(row.analyzed_at),
        });
      }
    }
  }

  // Calculate trends and convert to array
  const patterns: IssuePattern[] = [];
  for (const [category, data] of patternMap.entries()) {
    let trend: 'improving' | 'stable' | 'worsening' = 'stable';

    // Compare recent week vs older data
    const recentRate = data.recentCount / 7; // per day in recent week
    const olderRate = data.olderCount / Math.max(days - 7, 1); // per day in older period

    if (recentRate < olderRate * 0.5) {
      trend = 'improving';
    } else if (recentRate > olderRate * 1.5) {
      trend = 'worsening';
    }

    patterns.push({
      category,
      severity: data.severity,
      count: data.count,
      recentCount: data.recentCount,
      trend,
      lastSeen: data.lastSeen,
    });
  }

  // Sort by frequency (descending)
  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Phase 3: Get GOLDEN dimension trends over time
 */
export interface GoldenDimensionTrend {
  dimension: string;
  weeklyData: Array<{
    weekStart: string;
    avgScore: number;
    improvement: number;
  }>;
}

export function getGoldenTrendByDimension(weeks = 8): GoldenDimensionTrend[] {
  const db = getDatabase();

  const dimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'];
  const results: GoldenDimensionTrend[] = [];

  for (const dimension of dimensions) {
    const stmt = db.prepare(`
      WITH weekly_data AS (
        SELECT
          DATE(analyzed_at, 'weekday 0', '-6 days') as week_start,
          AVG(golden_${dimension}) as avg_score
        FROM prompt_history
        WHERE analyzed_at >= DATE('now', '-' || ? || ' weeks')
        GROUP BY week_start
        ORDER BY week_start ASC
      )
      SELECT
        week_start,
        avg_score,
        avg_score - LAG(avg_score) OVER (ORDER BY week_start) as improvement
      FROM weekly_data
    `);

    const rows = stmt.all(weeks * 7) as Array<{
      week_start: string;
      avg_score: number;
      improvement: number | null;
    }>;

    results.push({
      dimension,
      weeklyData: rows.map(row => ({
        weekStart: row.week_start,
        avgScore: Math.round(row.avg_score),
        improvement: Math.round(row.improvement || 0),
      })),
    });
  }

  return results;
}

/**
 * Phase 3: Get consecutive improvements analysis
 */
export interface ConsecutiveImprovement {
  startDate: string;
  endDate: string;
  improvementCount: number;
  scoreIncrease: number;
  averageGain: number;
}

export function getConsecutiveImprovements(limit = 10): ConsecutiveImprovement[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    WITH daily_scores AS (
      SELECT
        DATE(analyzed_at) as date,
        AVG(overall_score) as avg_score
      FROM prompt_history
      GROUP BY DATE(analyzed_at)
      ORDER BY date ASC
    ),
    improvements AS (
      SELECT
        date,
        avg_score,
        avg_score - LAG(avg_score) OVER (ORDER BY date) as improvement
      FROM daily_scores
    )
    SELECT * FROM improvements
    WHERE improvement > 0
    ORDER BY date DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    date: string;
    avg_score: number;
    improvement: number;
  }>;

  // Group consecutive improvements
  const improvements: ConsecutiveImprovement[] = [];
  let currentStreak: { startDate: string; endDate: string; count: number; totalGain: number } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prevRow = i > 0 ? rows[i - 1] : null;

    const isConsecutive = prevRow &&
      new Date(prevRow.date).getTime() - new Date(row.date).getTime() === 86400000; // 1 day

    if (isConsecutive && currentStreak) {
      currentStreak.count++;
      currentStreak.totalGain += row.improvement;
      currentStreak.startDate = row.date; // Update start (going backwards)
    } else {
      if (currentStreak && currentStreak.count > 1) {
        improvements.push({
          startDate: currentStreak.startDate,
          endDate: currentStreak.endDate,
          improvementCount: currentStreak.count,
          scoreIncrease: Math.round(currentStreak.totalGain),
          averageGain: Math.round(currentStreak.totalGain / currentStreak.count),
        });
      }
      currentStreak = {
        startDate: row.date,
        endDate: row.date,
        count: 1,
        totalGain: row.improvement,
      };
    }
  }

  // Add final streak
  if (currentStreak && currentStreak.count > 1) {
    improvements.push({
      startDate: currentStreak.startDate,
      endDate: currentStreak.endDate,
      improvementCount: currentStreak.count,
      scoreIncrease: Math.round(currentStreak.totalGain),
      averageGain: Math.round(currentStreak.totalGain / currentStreak.count),
    });
  }

  return improvements;
}

/**
 * Phase 3: Get category performance analysis
 */
export interface CategoryPerformance {
  category: string;
  count: number;
  averageScore: number;
  bestScore: number;
  trend: 'improving' | 'stable' | 'declining';
  commonWeakness?: string;
}

export function getCategoryPerformance(): CategoryPerformance[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      category,
      COUNT(*) as count,
      AVG(overall_score) as avg_score,
      MAX(overall_score) as best_score,
      AVG(CASE WHEN analyzed_at >= DATE('now', '-7 days') THEN overall_score ELSE NULL END) as recent_avg,
      AVG(CASE WHEN analyzed_at < DATE('now', '-7 days') AND analyzed_at >= DATE('now', '-14 days') THEN overall_score ELSE NULL END) as previous_avg,
      AVG(golden_goal) as goal,
      AVG(golden_output) as output,
      AVG(golden_limits) as limits,
      AVG(golden_data) as data,
      AVG(golden_evaluation) as evaluation,
      AVG(golden_next) as next
    FROM prompt_history
    WHERE category IS NOT NULL AND category != 'unknown'
    GROUP BY category
    HAVING count >= 3
    ORDER BY count DESC
  `);

  const rows = stmt.all() as Array<{
    category: string;
    count: number;
    avg_score: number;
    best_score: number;
    recent_avg: number | null;
    previous_avg: number | null;
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  }>;

  return rows.map(row => {
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (row.recent_avg && row.previous_avg) {
      const diff = row.recent_avg - row.previous_avg;
      if (diff > 5) trend = 'improving';
      else if (diff < -5) trend = 'declining';
    }

    // Find weakest dimension
    const dimensions = {
      goal: row.goal,
      output: row.output,
      limits: row.limits,
      data: row.data,
      evaluation: row.evaluation,
      next: row.next,
    };
    const weakest = Object.entries(dimensions).sort((a, b) => a[1] - b[1])[0];
    const dimensionLabels: Record<string, string> = {
      goal: '목표 명확성',
      output: '출력 형식',
      limits: '제약 조건',
      data: '데이터/컨텍스트',
      evaluation: '평가 기준',
      next: '다음 단계',
    };

    return {
      category: row.category,
      count: row.count,
      averageScore: Math.round(row.avg_score),
      bestScore: Math.round(row.best_score),
      trend,
      commonWeakness: weakest[1] < 60 ? dimensionLabels[weakest[0]] : undefined,
    };
  });
}

/**
 * Phase 3: Get predicted score based on moving average
 */
export function getPredictedScore(windowDays = 7): {
  predictedScore: number;
  confidence: 'high' | 'medium' | 'low';
  trend: number;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      AVG(overall_score) as avg_score,
      COUNT(*) as count
    FROM prompt_history
    WHERE analyzed_at >= DATE('now', '-' || ? || ' days')
  `);

  const recent = stmt.get(windowDays) as { avg_score: number; count: number };

  // Calculate trend
  const trendStmt = db.prepare(`
    WITH daily_scores AS (
      SELECT
        DATE(analyzed_at) as date,
        AVG(overall_score) as avg_score,
        ROW_NUMBER() OVER (ORDER BY DATE(analyzed_at) DESC) as rn
      FROM prompt_history
      WHERE analyzed_at >= DATE('now', '-14 days')
      GROUP BY DATE(analyzed_at)
    )
    SELECT
      (SELECT avg_score FROM daily_scores WHERE rn <= 3) as recent,
      (SELECT avg_score FROM daily_scores WHERE rn > 3 AND rn <= 6) as previous
  `);

  const trendData = trendStmt.get() as { recent: number | null; previous: number | null };
  const trend = trendData.recent && trendData.previous ? trendData.recent - trendData.previous : 0;

  // Confidence based on data availability
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (recent.count >= windowDays) confidence = 'high';
  else if (recent.count >= windowDays / 2) confidence = 'medium';

  return {
    predictedScore: Math.round(recent.avg_score || 0),
    confidence,
    trend: Math.round(trend),
  };
}
