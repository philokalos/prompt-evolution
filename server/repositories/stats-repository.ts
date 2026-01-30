/**
 * Stats Repository
 * Database queries for statistics endpoints
 */

import type { Database } from 'better-sqlite3';

export interface StatsData {
  conversations: number;
  turns: number;
  userPrompts: number;
  avgEffectiveness: number;
  avgQuality: number;
  projects: number;
  lastSync: string | null;
  lastAnalysis: string | null;
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
}

/**
 * Get overall database statistics
 */
export function getOverallStats(db: Database): StatsData {
  // Get user prompt count
  const userPromptsResult = db
    .prepare("SELECT COUNT(*) as count FROM turns WHERE role = 'user'")
    .get() as { count: number };

  // Get average effectiveness
  const effectivenessResult = db
    .prepare(
      `
      SELECT AVG(CAST(value AS REAL)) as avgEffectiveness
      FROM quality_signals
      WHERE signal_type = 'effectiveness'
    `
    )
    .get() as { avgEffectiveness: number | null };

  // Get average quality
  const qualityResult = db
    .prepare(
      `
      SELECT AVG(CAST(value AS REAL)) as avgQuality
      FROM quality_signals
      WHERE signal_type = 'quality'
    `
    )
    .get() as { avgQuality: number | null };

  // Get last sync time
  const lastSyncResult = db
    .prepare(
      `
      SELECT MAX(created_at) as lastSync
      FROM conversations
    `
    )
    .get() as { lastSync: string | null };

  // Get last analysis time
  const lastAnalysisResult = db
    .prepare(
      `
      SELECT MAX(created_at) as lastAnalysis
      FROM quality_signals
    `
    )
    .get() as { lastAnalysis: string | null };

  // Get average GOLDEN scores
  const goldenScores = {
    goal: 0,
    output: 0,
    limits: 0,
    data: 0,
    evaluation: 0,
    next: 0,
  };

  const dimensions = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
  for (const dim of dimensions) {
    const result = db
      .prepare(
        `
        SELECT AVG(value) as avgScore
        FROM quality_signals
        WHERE signal_type = ?
      `
      )
      .get(dim) as { avgScore: number | null };

    goldenScores[dim] = Math.round((result.avgScore ?? 0) * 100);
  }

  return {
    conversations: 0, // Will be set by caller using existing functions
    turns: 0, // Will be set by caller using existing functions
    userPrompts: userPromptsResult.count,
    avgEffectiveness: Math.round((effectivenessResult.avgEffectiveness ?? 0) * 100) / 100,
    avgQuality: Math.round((qualityResult.avgQuality ?? 0) * 100) / 100,
    projects: 0, // Will be set by caller using existing functions
    lastSync: lastSyncResult.lastSync,
    lastAnalysis: lastAnalysisResult.lastAnalysis,
    goldenScores,
  };
}
