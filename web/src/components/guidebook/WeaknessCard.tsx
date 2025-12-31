import type { ImprovementArea } from '@/api/client';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface WeaknessCardProps {
  weakness: ImprovementArea;
  rank: number;
}

export default function WeaknessCard({ weakness, rank }: WeaknessCardProps) {
  const priorityConfig = {
    high: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: AlertCircle,
      label: 'HIGH',
    },
    medium: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      icon: AlertTriangle,
      label: 'MEDIUM',
    },
    low: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      icon: Info,
      label: 'LOW',
    },
  };

  const config = priorityConfig[weakness.priority];
  const Icon = config.icon;
  const scorePercent = (weakness.currentScore * 100).toFixed(0);
  const targetPercent = (weakness.targetScore * 100).toFixed(0);

  return (
    <div className={`card ${config.bg} ${config.border} border`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={config.text} size={18} />
          <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
        </div>
        <div className="text-xs text-gray-500">#{rank}</div>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-gray-100 mb-2">{weakness.area}</h4>

      {/* Score Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Current: {scorePercent}%</span>
          <span>Target: {targetPercent}%</span>
        </div>
        <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
          <div
            className={`h-full ${config.text.replace('text-', 'bg-')} rounded-full transition-all duration-300`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Advice */}
      <p className="text-sm text-gray-400 mb-3">{weakness.specificAdvice}</p>

      {/* Impact */}
      <div className="text-xs text-gray-500 border-t border-dark-border pt-2 mt-2">
        <span className="text-gray-400">Impact: </span>
        {weakness.estimatedImpact}
      </div>
    </div>
  );
}
