import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TrendDataPoint } from '@/api/client';

interface VolumeTrendChartProps {
  data: TrendDataPoint[];
  trend: 'improving' | 'declining' | 'stable';
  changePercent: number;
}

export default function VolumeTrendChart({
  data,
  trend,
  changePercent,
}: VolumeTrendChartProps) {
  const trendIcon = {
    improving: <TrendingUp className="text-accent-success" size={20} />,
    declining: <TrendingDown className="text-accent-primary" size={20} />,
    stable: <Minus className="text-gray-400" size={20} />,
  };

  const trendColor = {
    improving: 'text-accent-success',
    declining: 'text-accent-primary',
    stable: 'text-gray-400',
  };

  return (
    <div>
      {/* Trend indicator */}
      <div className="flex items-center gap-2 mb-4">
        {trendIcon[trend]}
        <span className={`text-sm font-medium ${trendColor[trend]}`}>
          {trend === 'stable'
            ? 'Stable'
            : `${Math.abs(changePercent)}% ${trend === 'improving' ? 'increase' : 'decrease'}`}
        </span>
        <span className="text-sm text-gray-400">vs previous period</span>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={12}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#16213e',
                border: '1px solid #0f3460',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#00d9ff' }}
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00d9ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#00d9ff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
