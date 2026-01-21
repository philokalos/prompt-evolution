import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Award,
  Flame,
  Calendar,
} from 'lucide-react';

interface ScoreTrendPoint {
  date: string;
  avgScore: number;
  count: number;
}

interface WeeklyStatPoint {
  weekStart: string;
  avgScore: number;
  count: number;
  improvement: number;
}

interface MonthlyStatPoint {
  month: string;
  avgScore: number;
  count: number;
  gradeDistribution: Record<string, number>;
}

interface ImprovementAnalysis {
  overallImprovement: number;
  bestDimension: string;
  worstDimension: string;
  streak: number;
  milestones: Array<{ type: string; date: string; value: number }>;
}

interface Stats {
  totalAnalyses: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

export default function ProgressTracker() {
  const { t } = useTranslation('analysis');
  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<ScoreTrendPoint[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatPoint[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStatPoint[]>([]);
  const [improvement, setImprovement] = useState<ImprovementAnalysis | null>(null);
  const [goldenAverages, setGoldenAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, trendData, weeklyData, monthlyData, avgData, improvementData] =
        await Promise.all([
          window.electronAPI.getStats(),
          window.electronAPI.getScoreTrend(30),
          window.electronAPI.getWeeklyStats(8),
          window.electronAPI.getMonthlyStats(6),
          window.electronAPI.getGoldenAverages(30),
          window.electronAPI.getImprovementAnalysis(),
        ]);
      setStats(statsData as Stats);
      setTrend(trendData as ScoreTrendPoint[]);
      setWeeklyStats(weeklyData as WeeklyStatPoint[]);
      setMonthlyStats(monthlyData as MonthlyStatPoint[]);
      setGoldenAverages(avgData as Record<string, number>);
      setImprovement(improvementData as ImprovementAnalysis);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate chart dimensions
  const chartHeight = 120;
  const chartWidth = 280;

  const chartData = useMemo(() => {
    switch (timeRange) {
      case 'weekly':
        return weeklyStats.map((w) => ({
          label: w.weekStart.slice(5),
          value: w.avgScore,
          count: w.count,
        }));
      case 'monthly':
        return monthlyStats.map((m) => ({
          label: m.month.slice(5),
          value: m.avgScore,
          count: m.count,
        }));
      default:
        return trend.map((t) => ({
          label: t.date.slice(5),
          value: t.avgScore,
          count: t.count,
        }));
    }
  }, [timeRange, trend, weeklyStats, monthlyStats]);

  const chartPoints = useMemo(() => {
    if (chartData.length === 0) return '';

    const maxScore = 100;
    const minScore = 0;
    const xStep = chartWidth / Math.max(chartData.length - 1, 1);

    return chartData
      .map((point, i) => {
        const x = i * xStep;
        const y = chartHeight - ((point.value - minScore) / (maxScore - minScore)) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [chartData]);

  const getTrendIcon = () => {
    switch (stats?.recentTrend) {
      case 'improving':
        return <TrendingUp size={20} className="text-accent-success" />;
      case 'declining':
        return <TrendingDown size={20} className="text-accent-error" />;
      default:
        return <Minus size={20} className="text-gray-400" />;
    }
  };

  const getTrendText = () => {
    switch (stats?.recentTrend) {
      case 'improving':
        return t('progress.trend.improving');
      case 'declining':
        return t('progress.trend.declining');
      default:
        return t('progress.trend.stable');
    }
  };

  const formatMilestone = (type: string): string => {
    const key = `progress.milestone.${type}`;
    const translated = t(key);
    // Return the type itself if no translation found
    return translated === key ? type : translated;
  };

  const getDimensionLabel = (key: string): string => {
    return t(`progress.dimensions.${key}`, { defaultValue: key });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-accent-primary" />
        <span className="font-medium">{t('progress.title')}</span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-primary">
            {stats?.totalAnalyses || 0}
          </div>
          <div className="text-xs text-gray-400">{t('progress.totalAnalyses')}</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats?.averageScore || 0}%</div>
          <div className="text-xs text-gray-400">{t('progress.averageScore')}</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {getTrendIcon()}
            <span className="text-sm font-medium">{getTrendText()}</span>
          </div>
          <div className="text-xs text-gray-400">{t('progress.recentTrend')}</div>
        </div>
      </div>

      {/* Improvement & Streak */}
      {improvement && (improvement.streak > 0 || improvement.overallImprovement !== 0) && (
        <div className="grid grid-cols-2 gap-3">
          {improvement.streak > 0 && (
            <div className="bg-dark-surface rounded-lg p-3 flex items-center gap-3">
              <Flame size={24} className="text-orange-400" />
              <div>
                <div className="text-lg font-bold">{t('progress.streak', { count: improvement.streak })}</div>
                <div className="text-xs text-gray-400">{t('progress.streakLabel')}</div>
              </div>
            </div>
          )}
          {improvement.overallImprovement !== 0 && (
            <div className="bg-dark-surface rounded-lg p-3 flex items-center gap-3">
              {improvement.overallImprovement > 0 ? (
                <TrendingUp size={24} className="text-accent-success" />
              ) : (
                <TrendingDown size={24} className="text-accent-error" />
              )}
              <div>
                <div className="text-lg font-bold">
                  {improvement.overallImprovement > 0 ? '+' : ''}
                  {improvement.overallImprovement}%
                </div>
                <div className="text-xs text-gray-400">{t('progress.monthlyChange')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex gap-1 p-1 bg-dark-surface rounded-lg">
        {(['daily', 'weekly', 'monthly'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
              timeRange === range
                ? 'bg-accent-primary text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t(`progress.timeRange.${range}`)}
          </button>
        ))}
      </div>

      {/* Score Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Calendar size={16} />
            <span>{t(`progress.chartTitle.${timeRange}`)}</span>
          </div>
          <svg
            width={chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
          >
            {/* Grid lines */}
            {[25, 50, 75].map((level) => (
              <line
                key={level}
                x1={0}
                y1={chartHeight - (level / 100) * chartHeight}
                x2={chartWidth}
                y2={chartHeight - (level / 100) * chartHeight}
                stroke="#374151"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
            ))}

            {/* Area fill */}
            {chartData.length > 1 && (
              <path
                d={`${chartPoints} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                fill="url(#gradient)"
                opacity="0.3"
              />
            )}

            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Trend line */}
            <path
              d={chartPoints}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {chartData.map((point, i) => {
              const xStep = chartWidth / Math.max(chartData.length - 1, 1);
              const x = i * xStep;
              const y = chartHeight - (point.value / 100) * chartHeight;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={
                    point.value >= 70 ? '#10b981' : point.value >= 50 ? '#f59e0b' : '#ef4444'
                  }
                  stroke="#0d1117"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{chartData[0]?.label || ''}</span>
            <span>{chartData[chartData.length - 1]?.label || ''}</span>
          </div>
        </div>
      )}

      {/* GOLDEN Dimension Averages */}
      <div className="bg-dark-surface rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Target size={16} />
          <span>{t('progress.goldenAverage')}</span>
          {improvement && (
            <span className="ml-auto text-xs">
              {t('progress.strength')}:{' '}
              <span className="text-accent-success">
                {getDimensionLabel(improvement.bestDimension)}
              </span>
            </span>
          )}
        </div>
        <div className="space-y-2">
          {Object.entries(goldenAverages).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-400">
                {getDimensionLabel(key)}
              </div>
              <div className="flex-1 h-2 bg-dark-hover rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    value >= 70
                      ? 'bg-accent-success'
                      : value >= 50
                      ? 'bg-accent-warning'
                      : 'bg-accent-error'
                  }`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <div className="w-10 text-xs text-right">{value}%</div>
            </div>
          ))}
        </div>
        {improvement?.worstDimension && (
          <div className="mt-3 p-2 bg-accent-warning/10 rounded text-xs text-accent-warning">
            {t('progress.needsImprovement', { dimension: getDimensionLabel(improvement.worstDimension) })}
          </div>
        )}
      </div>

      {/* Milestones */}
      {improvement?.milestones && improvement.milestones.length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Award size={16} />
            <span>{t('progress.milestones')}</span>
          </div>
          <div className="space-y-2">
            {improvement.milestones.map((milestone, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span>{formatMilestone(milestone.type)}</span>
                <span className="text-accent-primary font-medium">
                  {milestone.value}점
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grade Distribution */}
      {stats?.gradeDistribution && Object.keys(stats.gradeDistribution).length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-3">{t('progress.gradeDistribution')}</div>
          <div className="flex justify-between items-end h-16">
            {['A', 'B', 'C', 'D', 'F'].map((grade) => {
              const count = stats.gradeDistribution[grade] || 0;
              const maxCount = Math.max(...Object.values(stats.gradeDistribution), 1);
              const height = (count / maxCount) * 100;

              return (
                <div key={grade} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 rounded-t transition-all duration-300 ${
                      grade === 'A'
                        ? 'bg-accent-success'
                        : grade === 'B'
                        ? 'bg-blue-400'
                        : grade === 'C'
                        ? 'bg-accent-warning'
                        : 'bg-accent-error'
                    }`}
                    style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-xs text-gray-400">{grade}</span>
                  <span className="text-xs text-gray-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
