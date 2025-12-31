import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Target } from 'lucide-react';

interface ScoreTrendPoint {
  date: string;
  avgScore: number;
  count: number;
}

interface Stats {
  totalAnalyses: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

interface ProgressTrackerProps {
  onClose?: () => void;
}

export default function ProgressTracker({ onClose }: ProgressTrackerProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<ScoreTrendPoint[]>([]);
  const [goldenAverages, setGoldenAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, trendData, avgData] = await Promise.all([
        window.electronAPI.getStats(),
        window.electronAPI.getScoreTrend(30),
        window.electronAPI.getGoldenAverages(30),
      ]);
      setStats(statsData as Stats);
      setTrend(trendData as ScoreTrendPoint[]);
      setGoldenAverages(avgData as Record<string, number>);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate chart dimensions
  const chartHeight = 120;
  const chartWidth = 280;

  const chartPoints = useMemo(() => {
    if (trend.length === 0) return '';

    const maxScore = 100;
    const minScore = 0;
    const xStep = chartWidth / Math.max(trend.length - 1, 1);

    return trend
      .map((point, i) => {
        const x = i * xStep;
        const y = chartHeight - ((point.avgScore - minScore) / (maxScore - minScore)) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [trend]);

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
        return '향상 중';
      case 'declining':
        return '하락 중';
      default:
        return '유지 중';
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-accent-primary" />
          <span className="font-medium">내 진행 상황</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            닫기
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-primary">
            {stats?.totalAnalyses || 0}
          </div>
          <div className="text-xs text-gray-400">총 분석</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">
            {stats?.averageScore || 0}%
          </div>
          <div className="text-xs text-gray-400">평균 점수</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {getTrendIcon()}
            <span className="text-sm font-medium">{getTrendText()}</span>
          </div>
          <div className="text-xs text-gray-400">최근 추세</div>
        </div>
      </div>

      {/* Score Trend Chart */}
      {trend.length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-3">30일 점수 추이</div>
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
            {trend.map((point, i) => {
              const xStep = chartWidth / Math.max(trend.length - 1, 1);
              const x = i * xStep;
              const y = chartHeight - (point.avgScore / 100) * chartHeight;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={point.avgScore >= 70 ? '#10b981' : point.avgScore >= 50 ? '#f59e0b' : '#ef4444'}
                  stroke="#0d1117"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{trend[0]?.date || ''}</span>
            <span>{trend[trend.length - 1]?.date || ''}</span>
          </div>
        </div>
      )}

      {/* GOLDEN Dimension Averages */}
      <div className="bg-dark-surface rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Target size={16} />
          <span>GOLDEN 차원별 평균 (30일)</span>
        </div>
        <div className="space-y-2">
          {Object.entries(goldenAverages).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-20 text-xs text-gray-400 capitalize">{key}</div>
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
      </div>

      {/* Grade Distribution */}
      {stats?.gradeDistribution && Object.keys(stats.gradeDistribution).length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-3">등급 분포</div>
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
