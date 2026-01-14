import { Router } from 'express';
import { getDatabase } from '../../src/index.js';
import {
  getVolumeTrend,
  getEffectivenessTrend,
  getQualityTrend,
  type TrendDataPoint,
} from '../repositories/index.js';
import {
  validateQuery,
  trendsQuerySchema,
  type TrendsQuery,
} from '../validation/index.js';

export const trendsRouter = Router();

type Metric = 'effectiveness' | 'quality' | 'volume';
type Trend = 'improving' | 'declining' | 'stable';

interface TrendsResponse {
  metric: Metric;
  period: string;
  groupBy: 'day' | 'week' | 'month';
  data: TrendDataPoint[];
  trend: Trend;
  changePercent: number;
}

// GET /api/trends - Time-series data for trend visualization
trendsRouter.get(
  '/',
  validateQuery(trendsQuerySchema),
  async (req, res, next) => {
    try {
      const db = getDatabase();
      const { period, metric, groupBy } = req.query as TrendsQuery;

      // Calculate date range
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let data: TrendDataPoint[];

      // Get data from repository based on metric
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
  }
);


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
