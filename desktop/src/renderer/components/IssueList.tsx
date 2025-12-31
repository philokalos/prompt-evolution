import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Lightbulb, CheckCircle2 } from 'lucide-react';

interface Issue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  suggestion: string;
}

interface IssueListProps {
  issues: Issue[];
  onApplySuggestion?: (suggestion: string) => void;
}

const SEVERITY_CONFIG = {
  high: {
    label: '높음',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: '🔴',
  },
  medium: {
    label: '중간',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    icon: '🟡',
  },
  low: {
    label: '낮음',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    icon: '🔵',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  'vague-goal': '모호한 목표',
  'missing-output': '출력 형식 미지정',
  'no-constraints': '제약조건 없음',
  'lacking-context': '컨텍스트 부족',
  'no-criteria': '평가 기준 없음',
  'unclear-next': '다음 단계 불분명',
  'too-short': '프롬프트 너무 짧음',
  'too-long': '프롬프트 너무 김',
  'ambiguous': '모호한 표현',
  'jargon': '전문 용어 과다',
  'analysis': '분석 관련',
  default: '기타',
};

export default function IssueList({ issues, onApplySuggestion }: IssueListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleApplySuggestion = (index: number, suggestion: string) => {
    if (onApplySuggestion) {
      onApplySuggestion(suggestion);
      setAppliedIndices(new Set([...appliedIndices, index]));
    }
  };

  const getCategoryLabel = (category: string): string => {
    return CATEGORY_LABELS[category] || CATEGORY_LABELS.default;
  };

  if (issues.length === 0) {
    return (
      <div className="bg-dark-surface rounded-lg p-4 text-center">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-accent-success" />
        <p className="text-sm text-gray-400">발견된 문제가 없습니다!</p>
        <p className="text-xs text-gray-500 mt-1">프롬프트가 잘 작성되었습니다.</p>
      </div>
    );
  }

  // Group issues by severity for summary
  const severityCounts = {
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
  };

  return (
    <div className="space-y-3">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle size={16} className="text-accent-warning" />
          <span>발견된 문제 ({issues.length})</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {severityCounts.high > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {severityCounts.high}
            </span>
          )}
          {severityCounts.medium > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {severityCounts.medium}
            </span>
          )}
          {severityCounts.low > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {severityCounts.low}
            </span>
          )}
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-2">
        {issues.map((issue, index) => {
          const config = SEVERITY_CONFIG[issue.severity];
          const isExpanded = expandedIndex === index;
          const isApplied = appliedIndices.has(index);

          return (
            <div
              key={index}
              className={`bg-dark-surface rounded-lg overflow-hidden border ${config.borderColor} transition-all duration-200 ${
                isApplied ? 'opacity-50' : ''
              }`}
            >
              {/* Issue header - clickable */}
              <button
                onClick={() => toggleExpand(index)}
                className="w-full p-3 flex items-start gap-3 text-left hover:bg-dark-hover transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getCategoryLabel(issue.category)}
                    </span>
                  </div>
                  <p className={`text-sm ${isApplied ? 'line-through text-gray-500' : ''}`}>
                    {issue.message}
                  </p>
                </div>

                {isApplied && (
                  <CheckCircle2 size={16} className="text-accent-success flex-shrink-0" />
                )}
              </button>

              {/* Expanded suggestion */}
              {isExpanded && !isApplied && (
                <div className="px-3 pb-3 pt-0 border-t border-dark-border">
                  <div className="mt-3 p-3 bg-dark-hover rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lightbulb size={14} className="text-accent-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">제안</p>
                        <p className="text-sm text-gray-200">{issue.suggestion}</p>
                      </div>
                    </div>
                    {onApplySuggestion && (
                      <button
                        onClick={() => handleApplySuggestion(index, issue.suggestion)}
                        className="mt-3 w-full py-1.5 px-3 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary text-xs rounded-md transition-colors"
                      >
                        이 제안 적용하기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick tips */}
      {severityCounts.high > 0 && (
        <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
          <p className="text-xs text-red-400">
            💡 <strong>높음</strong> 심각도 문제를 먼저 해결하면 프롬프트 품질이 크게 향상됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
