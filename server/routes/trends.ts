import { Router } from 'express';
import { getDatabase } from '../../src/index.js';

export const trendsRouter = Router();

type Metric = 'effectiveness' | 'quality' | 'volume';
type GroupBy = 'day' | 'week' | 'month';
type Trend = 'improving' | 'declining' | 'stable';

interface TrendDataPoint {
  date: string;
  value: number;
  count: number;
}

interface TrendsResponse {
  metric: Metric;
  period: string;
  groupBy: GroupBy;
  data: TrendDataPoint[];
  trend: Trend;
  changePercent: number;
}

// GET /api/trends - Time-series data for trend visualization
trendsRouter.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      period = '30d',
      metric = 'volume',
      groupBy = 'day',
    } = req.query as {
      period?: string;
      metric?: Metric;
      groupBy?: GroupBy;
    };

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let data: TrendDataPoint[];

    switch (metric) {
      case 'volume':
        data = getVolumeTrend(db, startDate, groupBy);
        break;
      case 'effectiveness':
        data = getEffectivenessTrend(db, startDate, groupBy);
        break;
      case 'quality':
        data = getQualityTrend(db, startDate, groupBy);
        break;
      default:
        data = getVolumeTrend(db, startDate, groupBy);
    }

    // Calculate trend direction and change percentage
    const { trend, changePercent } = calculateTrendDirection(data);

    const response: TrendsResponse = {
      metric: metric as Metric,
      period,
      groupBy,
      data,
      trend,
      changePercent,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

function getVolumeTrend(
  db: ReturnType<typeof getDatabase>,
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

function getEffectivenessTrend(
  db: ReturnType<typeof getDatabase>,
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

function getQualityTrend(
  db: ReturnType<typeof getDatabase>,
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

function calculateTrendDirection(data: TrendDataPoint[]): {
  trend: Trend;
  changePercent: number;
} {
  if (data.length < 2) {
    return { trend: 'stable', changePercent: 0 };
  }

  // Compare first half to second half
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);

  const firstAvg =
    firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

  if (firstAvg === 0) {
    return { trend: secondAvg > 0 ? 'improving' : 'stable', changePercent: 0 };
  }

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
  const roundedChange = Math.round(changePercent * 10) / 10;

  let trend: Trend;
  if (roundedChange > 5) {
    trend = 'improving';
  } else if (roundedChange < -5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return { trend, changePercent: roundedChange };
}
