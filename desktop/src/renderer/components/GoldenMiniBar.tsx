import { useTranslation } from 'react-i18next';

interface GoldenScores {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
}

interface GoldenMiniBarProps {
  scores: GoldenScores;
  grade: string;
}

const DIMENSIONS = [
  { key: 'goal', label: 'G' },
  { key: 'output', label: 'O' },
  { key: 'limits', label: 'L' },
  { key: 'data', label: 'D' },
  { key: 'evaluation', label: 'E' },
  { key: 'next', label: 'N' },
] as const;

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-accent-success';
  if (score >= 40) return 'text-accent-warning';
  return 'text-accent-error';
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-accent-success';
    case 'B': return 'text-blue-400';
    case 'C': return 'text-accent-warning';
    default: return 'text-accent-error';
  }
}

export default function GoldenMiniBar({ scores, grade }: GoldenMiniBarProps) {
  const { t } = useTranslation('analysis');

  return (
    <div className="flex items-center gap-2 flex-wrap px-1 py-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {DIMENSIONS.map(({ key, label }) => {
          const value = Math.round(scores[key as keyof GoldenScores]);
          return (
            <span key={key} className={`text-[10px] font-mono ${getScoreColor(value)}`}>
              {label}:{value}%
            </span>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className={`text-sm font-bold ${getGradeColor(grade)}`}>{grade}</span>
        <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
          {t(`gradeMessage.${grade}`)}
        </span>
      </div>
    </div>
  );
}
