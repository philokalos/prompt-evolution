/**
 * Issue Pattern Insights Component
 * Phase 3: Visualize and analyze recurring issues with trend analysis
 */

import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import type { IssuePattern } from '../electron.d';

const DIMENSION_TIPS: Record<string, string> = {
  'goal': '프롬프트의 목적을 명확히 하세요. "~를 해줘" 대신 "~를 위해 ~를 해줘"',
  'output': '원하는 출력 형식을 구체적으로 명시하세요 (JSON, 마크다운, 단계별 등)',
  'limits': '제약 조건을 명확히 하세요 (100줄 이내, ES6만 사용, 외부 라이브러리 없이)',
  'data': '충분한 배경 정보를 제공하세요 (프로젝트 구조, 프레임워크, 관련 코드)',
  'evaluation': '성공 기준을 명시하세요 (테스트 통과, API 호환성 유지 등)',
  'next': '후속 작업을 명시하세요 (구현 후 테스트, 문서화 등)',
};

export default function IssuePatternInsights() {
  const [patterns, setPatterns] = useState<IssuePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadPatterns();
  }, [days]);

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

  const getTrendText = (trend: IssuePattern['trend']) => {
    switch (trend) {
      case 'improving':
        return '개선 중';
      case 'worsening':
        return '악화 중';
      default:
        return '유지 중';
    }
  };

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

  const getSeverityBadge = (severity: IssuePattern['severity']) => {
    const colors = {
      high: 'bg-red-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-blue-500 text-white',
    };

    const labels = {
      high: '높음',
      medium: '중간',
      low: '낮음',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[severity]}`}>
        {labels[severity]}
      </span>
    );
  };

  const getTipForCategory = (category: string): string | null => {
    // Try to match category to a GOLDEN dimension
    const categoryLower = category.toLowerCase();
    for (const [key, tip] of Object.entries(DIMENSION_TIPS)) {
      if (categoryLower.includes(key) || category.includes(key)) {
        return tip;
      }
    }
    return null;
  };

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
        <p>이슈 패턴 데이터가 충분하지 않습니다</p>
        <p className="text-sm mt-2">더 많은 프롬프트를 분석하면 패턴이 나타납니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-accent-primary" />
          <span className="font-medium">이슈 패턴 분석</span>
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
              {d}일
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
          <div className="text-xs text-gray-400">총 이슈</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-warning">
            {patterns.length}
          </div>
          <div className="text-xs text-gray-400">이슈 유형</div>
        </div>
        <div className="bg-dark-surface rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-success">
            {patterns.filter(p => p.trend === 'improving').length}
          </div>
          <div className="text-xs text-gray-400">개선 중</div>
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
                      <span>{pattern.count}회 발생</span>
                      <span>최근 {pattern.recentCount}회</span>
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
                      💡 개선 팁
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
          <div className="text-sm font-medium mb-2">트렌드 요약</div>
          <div className="space-y-1 text-xs">
            {patterns.filter(p => p.trend === 'improving').length > 0 && (
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp size={14} />
                <span>
                  {patterns.filter(p => p.trend === 'improving').length}개 이슈가 개선되고 있습니다
                </span>
              </div>
            )}
            {patterns.filter(p => p.trend === 'worsening').length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <TrendingDown size={14} />
                <span>
                  {patterns.filter(p => p.trend === 'worsening').length}개 이슈가 악화되고 있습니다 - 주의가 필요합니다
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
