import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ProgressPoint } from '@/api/client';

interface ProgressChartProps {
  data: ProgressPoint[];
}

export default function ProgressChart({ data }: ProgressChartProps) {
  // Format data for chart
  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    score: Math.round(point.averageScore * 100),
    prompts: point.promptCount,
    category: point.topCategory,
  }));

  // Calculate trend
  const firstScore = chartData.length > 0 ? chartData[0].score : 0;
  const lastScore = chartData.length > 0 ? chartData[chartData.length - 1].score : 0;
  const trend = lastScore - firstScore;
  const trendDirection = trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable';

  const trendConfig = {
    improving: { color: '#10B981', label: 'Improving', icon: '↑' },
    declining: { color: '#EF4444', label: 'Declining', icon: '↓' },
    stable: { color: '#6B7280', label: 'Stable', icon: '→' },
  };

  const config = trendConfig[trendDirection];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { prompts: number; category: string } }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-dark-surface border border-dark-border rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-accent-primary font-semibold">{data.value}% Score</p>
          <p className="text-gray-500 text-xs">{data.payload.prompts} prompts</p>
          <p className="text-gray-500 text-xs capitalize">{data.payload.category.replace('-', ' ')}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Trend Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          Score over time ({chartData.length} data points)
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: `${config.color}20`, color: config.color }}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
          {trend !== 0 && (
            <span className="ml-1">
              ({trend > 0 ? '+' : ''}{trend}%)
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#6B7280"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#6B7280"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line at 70% (good threshold) */}
          <ReferenceLine
            y={70}
            stroke="#10B981"
            strokeDasharray="5 5"
            label={{ value: 'Good', fill: '#10B981', fontSize: 12, position: 'right' }}
          />

          {/* Reference line at 50% (average threshold) */}
          <ReferenceLine
            y={50}
            stroke="#F59E0B"
            strokeDasharray="5 5"
            label={{ value: 'Avg', fill: '#F59E0B', fontSize: 12, position: 'right' }}
          />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ fill: '#6366F1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#6366F1', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-accent-success" style={{ borderStyle: 'dashed' }} />
          <span>Good (70%+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-accent-warning" style={{ borderStyle: 'dashed' }} />
          <span>Average (50%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-secondary" />
          <span>Your Score</span>
        </div>
      </div>
    </div>
  );
}
