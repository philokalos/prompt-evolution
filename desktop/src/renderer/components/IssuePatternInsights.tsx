/**
 * Issue Pattern Insights Component
 * Phase 3: Visualize and analyze recurring issues with trend analysis
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import type { IssuePattern } from '../electron.d';

// Dimension keys for translation lookup
const DIMENSION_KEYS = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;

export default function IssuePatternInsights() {
  const { t } = useTranslation('analysis');
  const [patterns, setPatterns] = useState<IssuePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const loadPatterns = async () => {
      setLoading(true);
      try {
        const data = await window.electronAPI.getIssuePatterns(days);
        setPatterns(data);
      } catch (error) {
        console.error('Failed to load issue patterns:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPatterns();
  }, [days]);

  const getTrendIcon = (trend: IssuePattern['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={16} className="text-green-400" />;
      case 'worsening':
        return <TrendingDown size={16} className="text-red-400" />;
      default:
        return <Minus size={16} className="text-gray-400" />;
    }
  };

  const getTrendText = useCallback((trend: IssuePattern['trend']) => {
    switch (trend) {
      case 'improving':
        return t('issuePatterns.trend.improving');
      case 'worsening':
        return t('issuePatterns.trend.worsening');
      default:
        return t('issuePatterns.trend.stable');
    }
  }, [t]);

  const getSeverityColor = (severity: IssuePattern['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/10 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const getSeverityBadge = useCallback((severity: IssuePattern['severity']) => {
    const colors = {
      high: 'bg-red-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-blue-500 text-white',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[severity]}`}>
        {t(`issuePatterns.severity.${severity}`)}
      </span>
    );
  }, [t]);

  const getTipForCategory = useCallback((category: string): string | null => {
    // Try to match category to a GOLDEN dimension
    const categoryLower = category.toLowerCase();
    for (const key of DIMENSION_KEYS) {
      if (categoryLower.includes(key) || category.includes(key)) {
        return t(`issuePatterns.dimensionTips.${key}`);
      }
    }
    return null;
  }, [t]);

  const toggleExpand = (category: string) => {
    setExpandedPattern(expandedPattern === category ? null : category);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p>{t('issuePatterns.empty')}</p>
        <p className="text-sm mt-2">{t('issuePatterns.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-accent-primary" />
          <span className="font-medium">{t('issuePatterns.title')}</span>
        </div>
        <div className="flex gap-1 p-1 bg-dark-surface rounded-lg text-xs">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded transition-colors ${
                days === d
                  ? 'bg-accent-primary text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t('issuePatterns.days', { count: d })}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-error">
            {patterns.reduce((sum, p) => sum + p.count, 0)}
          </div>
          <div className="text-xs text-gray-400">{t('issuePatterns.totalIssues')}</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-warning">
            {patterns.length}
          </div>
          <div className="text-xs text-gray-400">{t('issuePatterns.issueTypes')}</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-success">
            {patterns.filter(p => p.trend === 'improving').length}
          </div>
          <div className="text-xs text-gray-400">{t('issuePatterns.improving')}</div>
        </div>
      </div>

      {/* Issue Patterns List */}
      <div className="space-y-2">
        {patterns.map((pattern) => {
          const isExpanded = expandedPattern === pattern.category;
          const tip = getTipForCategory(pattern.category);

          return (
            <div
              key={pattern.category}
              className={`border rounded-lg overflow-hidden transition-colors ${getSeverityColor(pattern.severity)}`}
            >
              <button
                onClick={() => toggleExpand(pattern.category)}
                className="w-full p-3 text-left hover:bg-dark-hover transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="font-medium text-sm">{pattern.category}</span>
                      {getSeverityBadge(pattern.severity)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 ml-6">
                      <span>{t('issuePatterns.occurrences', { count: pattern.count })}</span>
                      <span>{t('issuePatterns.recentOccurrences', { count: pattern.recentCount })}</span>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(pattern.trend)}
                        <span>{getTrendText(pattern.trend)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {isExpanded && tip && (
                <div className="px-3 pb-3 border-t border-gray-700/30">
                  <div className="mt-3 p-3 bg-dark-surface rounded-lg">
                    <div className="text-xs font-medium text-accent-primary mb-1">
                      {t('issuePatterns.improvementTip')}
                    </div>
                    <div className="text-xs text-gray-300">{tip}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trends Summary */}
      {patterns.some(p => p.trend !== 'stable') && (
        <div className="bg-dark-surface rounded-lg p-4 border border-gray-700/30">
          <div className="text-sm font-medium mb-2">{t('issuePatterns.trendSummary')}</div>
          <div className="space-y-1 text-xs">
            {patterns.filter(p => p.trend === 'improving').length > 0 && (
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp size={14} />
                <span>
                  {t('issuePatterns.trendImproving', { count: patterns.filter(p => p.trend === 'improving').length })}
                </span>
              </div>
            )}
            {patterns.filter(p => p.trend === 'worsening').length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <TrendingDown size={14} />
                <span>
                  {t('issuePatterns.trendWorsening', { count: patterns.filter(p => p.trend === 'worsening').length })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
