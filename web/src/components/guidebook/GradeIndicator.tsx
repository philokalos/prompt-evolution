import { ArrowRight, TrendingUp } from 'lucide-react';

interface GradeIndicatorProps {
  scoreBefore: number;
  scoreAfter: number;
}

export default function GradeIndicator({ scoreBefore, scoreAfter }: GradeIndicatorProps) {
  const beforePercent = (scoreBefore * 100).toFixed(0);
  const afterPercent = (scoreAfter * 100).toFixed(0);
  const improvement = ((scoreAfter - scoreBefore) / scoreBefore * 100).toFixed(0);
  const isImproved = scoreAfter > scoreBefore;

  return (
    <div className="flex items-center justify-center gap-4 py-3 bg-dark-bg rounded-lg">
      {/* Before Score */}
      <div className="text-center">
        <div className="text-2xl font-bold text-red-400">{beforePercent}</div>
        <div className="text-xs text-gray-500">Before</div>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-1">
        <div className="w-12 h-0.5 bg-gray-600" />
        <ArrowRight className="text-gray-400" size={20} />
      </div>

      {/* After Score */}
      <div className="text-center">
        <div className="text-2xl font-bold text-accent-success">{afterPercent}</div>
        <div className="text-xs text-gray-500">After</div>
      </div>

      {/* Improvement Badge */}
      {isImproved && (
        <div className="flex items-center gap-1 bg-accent-success/20 text-accent-success px-2 py-1 rounded-full">
          <TrendingUp size={14} />
          <span className="text-sm font-semibold">+{improvement}%</span>
        </div>
      )}
    </div>
  );
}
