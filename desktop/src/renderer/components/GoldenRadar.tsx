import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, X } from 'lucide-react';

interface GoldenRadarProps {
  scores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  size?: number;
}

const GOLDEN_LABELS = [
  { key: 'goal', label: 'G' },
  { key: 'output', label: 'O' },
  { key: 'limits', label: 'L' },
  { key: 'data', label: 'D' },
  { key: 'evaluation', label: 'E' },
  { key: 'next', label: 'N' },
] as const;

const GRID_LEVELS = [20, 40, 60, 80, 100] as const;

export default function GoldenRadar({ scores, size = 200 }: GoldenRadarProps) {
  const { t } = useTranslation(['analysis', 'help']);
  const center = size / 2;
  const maxRadius = size / 2 - 30;
  const [hoveredDimension, setHoveredDimension] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Helper to get GOLDEN dimension info from translations
  const getDimensionInfo = useCallback((label: string) => {
    const keyMap: Record<string, string> = { G: 'goal', O: 'output', L: 'limits', D: 'data', E: 'evaluation', N: 'next' };
    const key = keyMap[label] || label.toLowerCase();
    return {
      title: t(`help:golden.${key}.title`),
      short: t(`help:golden.${key}.short`),
      detail: t(`help:golden.${key}.detail`),
      improvement: t(`help:golden.${key}.improvement`),
    };
  }, [t]);

  // Calculate points for each dimension
  const points = useMemo(() => {
    const angleStep = (2 * Math.PI) / 6;
    const startAngle = -Math.PI / 2; // Start from top

    return GOLDEN_LABELS.map((item, index) => {
      const angle = startAngle + index * angleStep;
      const value = scores[item.key as keyof typeof scores] || 0;
      const radius = (value / 100) * maxRadius;

      return {
        ...item,
        angle,
        value,
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
        labelX: center + (maxRadius + 20) * Math.cos(angle),
        labelY: center + (maxRadius + 20) * Math.sin(angle),
      };
    });
  }, [scores, center, maxRadius]);

  // Generate polygon path
  const polygonPath = useMemo(() => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [points]);

  // Generate grid lines (hexagon levels)
  const gridLevels = useMemo(() => {
    return GRID_LEVELS.map((level) => {
      const radius = (level / 100) * maxRadius;
      const angleStep = (2 * Math.PI) / 6;
      const startAngle = -Math.PI / 2;

      const levelPoints = Array.from({ length: 6 }, (_, i) => {
        const angle = startAngle + i * angleStep;
        return {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
        };
      });

      return {
        level,
        path: levelPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z',
      };
    });
  }, [center, maxRadius]);

  // Generate axis lines
  const axisLines = useMemo(() => {
    const angleStep = (2 * Math.PI) / 6;
    const startAngle = -Math.PI / 2;

    return Array.from({ length: 6 }, (_, i) => {
      const angle = startAngle + i * angleStep;
      return {
        x1: center,
        y1: center,
        x2: center + maxRadius * Math.cos(angle),
        y2: center + maxRadius * Math.sin(angle),
      };
    });
  }, [center, maxRadius]);

  const getScoreColor = (value: number) => {
    if (value >= 70) return '#10b981'; // green
    if (value >= 50) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="radar-chart"
        role="img"
        aria-label={t('radar.ariaLabel', { goal: scores.goal, output: scores.output, limits: scores.limits, data: scores.data, evaluation: scores.evaluation, next: scores.next })}
      >
        {/* Background gradient */}
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid levels */}
        {gridLevels.map(({ level, path }) => (
          <path
            key={level}
            d={path}
            fill="none"
            stroke="#374151"
            strokeWidth="1"
            strokeDasharray={level === 100 ? 'none' : '2 2'}
            opacity={level === 100 ? 0.5 : 0.3}
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#374151"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}

        {/* Data polygon fill */}
        <path
          d={polygonPath}
          fill="url(#radarGradient)"
          className="radar-fill"
        />

        {/* Data polygon stroke */}
        <path
          d={polygonPath}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          filter="url(#glow)"
          className="radar-line"
        />

        {/* Data points */}
        {points.map((point) => (
          <g key={point.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={getScoreColor(point.value)}
              stroke="#0d1117"
              strokeWidth="2"
              className="transition-all duration-300"
            />
          </g>
        ))}

        {/* Labels - Interactive with hover */}
        {points.map((point) => {
          const dimInfo = getDimensionInfo(point.label);
          return (
            <g
              key={`label-${point.key}`}
              onMouseEnter={() => setHoveredDimension(point.label)}
              onMouseLeave={() => setHoveredDimension(null)}
              className="cursor-pointer"
            >
              <circle
                cx={point.labelX}
                cy={point.labelY}
                r="12"
                fill="transparent"
                className="hover:fill-gray-800"
              />
              <text
                x={point.labelX}
                y={point.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-xs font-bold transition-colors ${
                  hoveredDimension === point.label ? 'fill-indigo-400' : 'fill-gray-400'
                }`}
              >
                {point.label}
              </text>
              <title>{`${dimInfo.title}: ${dimInfo.short}`}</title>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredDimension && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs max-w-[200px] shadow-lg z-10">
          <div className="font-bold text-indigo-400">
            {getDimensionInfo(hoveredDimension).title}
          </div>
          <div className="text-gray-300 mt-1">
            {getDimensionInfo(hoveredDimension).short}
          </div>
        </div>
      )}

      {/* Help button */}
      <button
        onClick={() => setShowHelp(true)}
        className="absolute top-0 right-0 p-1 text-gray-500 hover:text-gray-300 transition-colors"
        title={t('radar.helpTitle')}
        aria-label={t('radar.helpTitle')}
      >
        <HelpCircle size={16} />
      </button>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHelp(false)}>
          <div
            className="bg-dark-card border border-dark-border rounded-xl p-4 max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">{t('radar.helpTitle')}</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label={t('radar.closeAria')}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {t('radar.helpDescription')}
            </p>
            <div className="space-y-3">
              {GOLDEN_LABELS.map(({ key, label }) => {
                const dimInfo = getDimensionInfo(label);
                const score = scores[key as keyof typeof scores];
                return (
                  <div key={key} className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: `${getScoreColor(score)}20`, color: getScoreColor(score) }}
                    >
                      {label}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{dimInfo.title}</span>
                        <span className="ml-auto text-sm" style={{ color: getScoreColor(score) }}>{score}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{dimInfo.short}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-dark-border">
              <p className="text-xs text-gray-500">
                {t('radar.helpTip')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Score legend */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 text-xs">
        {points.map((point) => {
          const dimInfo = getDimensionInfo(point.label);
          return (
            <div
              key={`score-${point.key}`}
              className="flex items-center gap-1 cursor-help"
              title={`${dimInfo.title}\n${dimInfo.short}\n\n💡 ${dimInfo.improvement}`}
            >
              <span className="text-gray-500">{point.label}</span>
              <span
                className="font-medium"
                style={{ color: getScoreColor(point.value) }}
              >
                {point.value}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
