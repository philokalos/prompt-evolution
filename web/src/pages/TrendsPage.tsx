import { useState } from 'react';
import { useTrends } from '@/hooks/useTrends';
import VolumeTrendChart from '@/components/charts/VolumeTrendChart';

type Metric = 'volume' | 'effectiveness' | 'quality';
type Period = '7d' | '30d' | '90d';
type GroupBy = 'day' | 'week' | 'month';

export default function TrendsPage() {
  const [metric, setMetric] = useState<Metric>('volume');
  const [period, setPeriod] = useState<Period>('30d');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  const { data: trends, isLoading, error } = useTrends({ metric, period, groupBy });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Trends</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Metric selector */}
        <div className="flex gap-2">
          {(['volume', 'effectiveness', 'quality'] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                metric === m
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-surface border border-dark-border text-gray-400 hover:text-gray-100'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-accent-secondary text-dark-bg'
                  : 'bg-dark-surface border border-dark-border text-gray-400 hover:text-gray-100'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>

        {/* Group by selector */}
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                groupBy === g
                  ? 'bg-accent-success text-dark-bg'
                  : 'bg-dark-surface border border-dark-border text-gray-400 hover:text-gray-100'
              }`}
            >
              By {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
          {metric.charAt(0).toUpperCase() + metric.slice(1)} Trend
        </h3>
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : error ? (
          <p className="text-red-400">Error loading trends: {error.message}</p>
        ) : trends && trends.data.length > 0 ? (
          <VolumeTrendChart
            data={trends.data}
            trend={trends.trend}
            changePercent={trends.changePercent}
          />
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No data available for the selected period
          </div>
        )}
      </div>
    </div>
  );
}
