/**
 * Trends Repository
 * Database queries for trends endpoints
 */

import type { Database } from 'better-sqlite3';

export type GroupBy = 'day' | 'week' | 'month';

export interface TrendDataPoint {
  date: string;
  value: number;
  count: number;
}

/**
 * Get volume trend data
 */
export function getVolumeTrend(
  db: Database,
  startDate: Date,
  groupBy: GroupBy
): TrendDataPoint[] {
  const dateFormat = getDateFormat(groupBy);

  const result = db
    .prepare(
      `
      SELECT
        strftime('${dateFormat}', started_at) as date,
        COUNT(*) as value,
        COUNT(*) as count
      FROM conversations
      WHERE started_at >= ?
      GROUP BY strftime('${dateFormat}', started_at)
      ORDER BY date ASC
    `
    )
    .all(startDate.toISOString()) as TrendDataPoint[];

  return result;
}

/**
 * Get effectiveness trend data
 */
export function getEffectivenessTrend(
  db: Database,
  startDate: Date,
  groupBy: GroupBy
): TrendDataPoint[] {
  const dateFormat = getDateFormat(groupBy);

  const result = db
    .prepare(
      `
      SELECT
        strftime('${dateFormat}', qs.created_at) as date,
        AVG(CAST(qs.value AS REAL)) as value,
        COUNT(*) as count
      FROM quality_signals qs
      WHERE qs.signal_type = 'effectiveness'
        AND qs.created_at >= ?
      GROUP BY strftime('${dateFormat}', qs.created_at)
      ORDER BY date ASC
    `
    )
    .all(startDate.toISOString()) as TrendDataPoint[];

  return result.map((r) => ({
    ...r,
    value: Math.round(r.value * 100) / 100,
  }));
}

/**
 * Get quality trend data
 */
export function getQualityTrend(
  db: Database,
  startDate: Date,
  groupBy: GroupBy
): TrendDataPoint[] {
  const dateFormat = getDateFormat(groupBy);

  const result = db
    .prepare(
      `
      SELECT
        strftime('${dateFormat}', qs.created_at) as date,
        AVG(CAST(qs.value AS REAL)) as value,
        COUNT(*) as count
      FROM quality_signals qs
      WHERE qs.signal_type = 'quality'
        AND qs.created_at >= ?
      GROUP BY strftime('${dateFormat}', qs.created_at)
      ORDER BY date ASC
    `
    )
    .all(startDate.toISOString()) as TrendDataPoint[];

  return result.map((r) => ({
    ...r,
    value: Math.round(r.value * 100) / 100,
  }));
}

/**
 * Get date format for SQL strftime based on groupBy
 */
function getDateFormat(groupBy: GroupBy): string {
  switch (groupBy) {
    case 'day':
      return '%Y-%m-%d';
    case 'week':
      return '%Y-W%W';
    case 'month':
      return '%Y-%m';
    default:
      return '%Y-%m-%d';
  }
}
