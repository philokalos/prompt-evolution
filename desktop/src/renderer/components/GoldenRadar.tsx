import { useMemo } from 'react';

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
  { key: 'goal', label: 'G', fullName: 'Goal' },
  { key: 'output', label: 'O', fullName: 'Output' },
  { key: 'limits', label: 'L', fullName: 'Limits' },
  { key: 'data', label: 'D', fullName: 'Data' },
  { key: 'evaluation', label: 'E', fullName: 'Evaluation' },
  { key: 'next', label: 'N', fullName: 'Next' },
] as const;

export default function GoldenRadar({ scores, size = 200 }: GoldenRadarProps) {
  const center = size / 2;
  const maxRadius = size / 2 - 30;
  const levels = [20, 40, 60, 80, 100];

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
    return levels.map((level) => {
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

        {/* Labels */}
        {points.map((point) => (
          <text
            key={`label-${point.key}`}
            x={point.labelX}
            y={point.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-bold fill-gray-400"
          >
            {point.label}
          </text>
        ))}
      </svg>

      {/* Score legend */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 text-xs">
        {points.map((point) => (
          <div
            key={`score-${point.key}`}
            className="flex items-center gap-1"
            title={point.fullName}
          >
            <span className="text-gray-500">{point.label}</span>
            <span
              className="font-medium"
              style={{ color: getScoreColor(point.value) }}
            >
              {point.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
