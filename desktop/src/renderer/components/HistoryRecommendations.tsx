import { useTranslation } from 'react-i18next';
import { AlertCircle, TrendingUp, TrendingDown, Lightbulb, BookOpen, Target } from 'lucide-react';
import type { HistoryRecommendation } from '../electron.d';

interface HistoryRecommendationsProps {
  recommendations: HistoryRecommendation[];
  comparisonWithHistory?: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
}

export default function HistoryRecommendations({
  recommendations,
  comparisonWithHistory,
}: HistoryRecommendationsProps) {
  const { t } = useTranslation('analysis');

  if (recommendations.length === 0 && !comparisonWithHistory?.improvement) {
    return null;
  }

  const getTypeIcon = (type: HistoryRecommendation['type']) => {
    switch (type) {
      case 'weakness':
        return <AlertCircle size={14} className="text-orange-400" />;
      case 'improvement':
        return <TrendingUp size={14} className="text-green-400" />;
      case 'reference':
        return <BookOpen size={14} className="text-blue-400" />;
      case 'pattern':
        return <Target size={14} className="text-purple-400" />;
    }
  };

  const getPriorityClass = (priority: HistoryRecommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-gray-500';
    }
  };

  return (
    <div className="space-y-3">
      {/* Comparison with history */}
      {comparisonWithHistory?.improvement && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            comparisonWithHistory.betterThanAverage
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-orange-500/10 border border-orange-500/30'
          }`}
        >
          {comparisonWithHistory.betterThanAverage ? (
            <TrendingUp size={16} className="text-green-400" />
          ) : (
            <TrendingDown size={16} className="text-orange-400" />
          )}
          <span className="text-sm">
            {comparisonWithHistory.improvement}
            {comparisonWithHistory.scoreDiff !== 0 && (
              <span className="text-gray-400 ml-1">
                ({comparisonWithHistory.scoreDiff > 0 ? '+' : ''}
                {comparisonWithHistory.scoreDiff} {t('history.points')})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Recommendations list */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb size={16} className="text-accent-primary" />
            <span>{t('history.basedRecommendations')}</span>
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div
                key={index}
                className={`bg-dark-surface rounded-lg p-3 border-l-2 ${getPriorityClass(
                  rec.priority
                )}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getTypeIcon(rec.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200">{rec.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{rec.message}</div>
                    {rec.examplePrompt && (
                      <div className="mt-2 p-2 bg-dark-hover rounded text-xs text-gray-500 truncate">
                        "{rec.examplePrompt}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
