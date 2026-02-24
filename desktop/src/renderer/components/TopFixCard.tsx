import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, ChevronDown, ChevronRight } from 'lucide-react';

interface TopFix {
  dimension: string;
  scoreDelta: number;
  issueDescription: string;
  beforeSnippet: string;
  afterSnippet: string;
  totalIssueCount: number;
}

interface TopFixCardProps {
  topFix: TopFix;
  onShowAllIssues?: () => void;
}

const DIMENSION_LABELS: Record<string, string> = {
  goal: 'Goal',
  output: 'Output',
  limits: 'Limits',
  data: 'Data',
  evaluation: 'Evaluation',
  next: 'Next',
};

export default function TopFixCard({ topFix, onShowAllIssues }: TopFixCardProps) {
  const { t } = useTranslation('analysis');
  const [showDiff, setShowDiff] = useState(false);

  const dimensionLabel = DIMENSION_LABELS[topFix.dimension] ?? topFix.dimension;
  const deltaPoints = Math.round(topFix.scoreDelta * 100);
  const remainingCount = topFix.totalIssueCount - 1;

  return (
    <div className="bg-dark-surface rounded-lg border border-accent-primary/30 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-accent-primary/20 flex items-center justify-center">
            <Zap size={12} className="text-accent-primary" />
          </div>
          <span className="text-xs font-medium text-accent-primary">
            {t('topFix.badge')}
          </span>
        </div>
        <span className="text-xs text-accent-success font-medium">
          {t('topFix.impact', { delta: deltaPoints })}
        </span>
      </div>

      {/* Issue description */}
      <div className="px-3 pb-2">
        <p className="text-sm text-gray-200">{topFix.issueDescription}</p>
        <span className="text-xs text-gray-500">
          {t('topFix.dimension', { dimension: dimensionLabel })}
        </span>
      </div>

      {/* Before/After toggle */}
      <button
        onClick={() => setShowDiff(!showDiff)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-hover transition-colors border-t border-dark-border"
      >
        {showDiff ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <span>{showDiff ? t('details.collapse') : `${t('topFix.before')} / ${t('topFix.after')}`}</span>
      </button>

      {/* Before/After diff */}
      {showDiff && (
        <div className="px-3 pb-3 space-y-2">
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded">
            <p className="text-[10px] text-red-400 font-medium mb-1">{t('topFix.before')}</p>
            <p className="text-xs text-gray-400 whitespace-pre-wrap break-words">{topFix.beforeSnippet}</p>
          </div>
          <div className="p-2 bg-green-500/10 border border-green-500/20 rounded">
            <p className="text-[10px] text-green-400 font-medium mb-1">{t('topFix.after')}</p>
            <p className="text-xs text-gray-200 whitespace-pre-wrap break-words">{topFix.afterSnippet}</p>
          </div>
        </div>
      )}

      {/* Show more issues link */}
      {remainingCount > 0 && onShowAllIssues && (
        <button
          onClick={onShowAllIssues}
          className="w-full px-3 py-2 text-xs text-gray-500 hover:text-gray-300 border-t border-dark-border transition-colors"
        >
          {t('topFix.showMore', { count: remainingCount })}
        </button>
      )}
    </div>
  );
}
