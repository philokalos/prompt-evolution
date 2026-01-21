/**
 * Improvement Impact Component
 * Phase 3: Track and visualize improvement streaks and their impact
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Award, Calendar, BarChart2 } from 'lucide-react';
import type { ConsecutiveImprovement } from '../electron.d';

export default function ImprovementImpact() {
  const { t, i18n } = useTranslation('analysis');
  const [improvements, setImprovements] = useState<ConsecutiveImprovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadImprovements();
  }, []);

  const loadImprovements = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getConsecutiveImprovements(10);
      setImprovements(data);
    } catch (error) {
      console.error('Failed to load improvements:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  }, [i18n.language]);

  const getDurationDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  const totalImprovements = improvements.reduce((sum, imp) => sum + imp.improvementCount, 0);
  const totalGain = improvements.reduce((sum, imp) => sum + imp.scoreIncrease, 0);
  const bestStreak = improvements.length > 0
    ? improvements.reduce((max, imp) => imp.improvementCount > max.improvementCount ? imp : max)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={20} className="text-accent-success" />
        <span className="font-medium">{t('improvement.title')}</span>
      </div>

      {/* Summary Cards */}
      {improvements.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-success">
                {totalImprovements}
              </div>
              <div className="text-xs text-gray-400">{t('improvement.totalImprovements')}</div>
            </div>
            <div className="bg-dark-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-primary">
                +{totalGain}
              </div>
              <div className="text-xs text-gray-400">{t('improvement.scoreGain')}</div>
            </div>
            <div className="bg-dark-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-warning">
                {bestStreak?.improvementCount || 0}
              </div>
              <div className="text-xs text-gray-400">{t('improvement.longestStreak')}</div>
            </div>
          </div>

          {/* Best Streak Highlight */}
          {bestStreak && (
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Award size={24} className="text-green-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-green-400 mb-1">{t('improvement.bestPerformance')}</div>
                  <div className="text-sm text-gray-300">
                    {t('improvement.dateRange', { start: formatDate(bestStreak.startDate), end: formatDate(bestStreak.endDate) })}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {t('improvement.bestPerformanceDetail', {
                      days: getDurationDays(bestStreak.startDate, bestStreak.endDate),
                      count: bestStreak.improvementCount,
                      score: bestStreak.scoreIncrease,
                      avg: bestStreak.averageGain
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Improvement Streaks List */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2 text-gray-400">
              <BarChart2 size={16} />
              <span>{t('improvement.improvementHistory')}</span>
            </div>
            {improvements.map((imp, index) => {
              const duration = getDurationDays(imp.startDate, imp.endDate);

              return (
                <div
                  key={index}
                  className="bg-dark-surface rounded-lg p-3 border border-gray-700/30 hover:border-accent-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} className="text-gray-400" />
                        <span className="text-sm font-medium">
                          {t('improvement.dateRange', { start: formatDate(imp.startDate), end: formatDate(imp.endDate) })}
                        </span>
                        <span className="text-xs text-gray-500">{t('improvement.days', { count: duration })}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="text-accent-success">
                          {t('improvement.consecutiveImprovements', { count: imp.improvementCount })}
                        </span>
                        <span>{t('improvement.points', { count: imp.scoreIncrease })}</span>
                        <span className="text-gray-500">{t('improvement.avgPerDay', { count: imp.averageGain })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-green-400">
                      <TrendingUp size={16} />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 h-1.5 bg-dark-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
                      style={{ width: `${Math.min((imp.scoreIncrease / 20) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insights */}
          <div className="bg-dark-surface rounded-lg p-4 border border-gray-700/30">
            <div className="text-sm font-medium mb-2">{t('improvement.insights')}</div>
            <div className="space-y-2 text-xs text-gray-300">
              {improvements.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-accent-primary">•</span>
                  <span>
                    {t('improvement.insightAverage', { count: improvements.length, avg: Math.round(totalGain / improvements.length) })}
                  </span>
                </div>
              )}
              {bestStreak && (
                <div className="flex items-start gap-2">
                  <span className="text-accent-success">•</span>
                  <span>
                    {t('improvement.insightBest', { date: formatDate(bestStreak.startDate), days: getDurationDays(bestStreak.startDate, bestStreak.endDate) })}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-accent-warning">•</span>
                <span>
                  {t('improvement.insightTip')}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <TrendingUp size={48} className="mb-4 opacity-50" />
          <p>{t('improvement.empty')}</p>
          <p className="text-sm mt-2">{t('improvement.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}
