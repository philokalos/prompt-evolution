import { useMemo, useState, useCallback } from 'react';
import { Lightbulb, Plus, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { GOLDEN_EXPLANATIONS, type GoldenDimension } from '../../shared/constants';

interface GoldenScores {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
}

interface GoldenActionTipsProps {
  scores: GoldenScores;
  onInsertTemplate?: (template: string) => void;
  maxTips?: number;
}

// Map score keys to GOLDEN dimension keys
const SCORE_TO_GOLDEN: Record<keyof GoldenScores, string> = {
  goal: 'G',
  output: 'O',
  limits: 'L',
  data: 'D',
  evaluation: 'E',
  next: 'N',
};

// Quick-insert templates for each dimension
const INSERTION_TEMPLATES: Record<string, string[]> = {
  G: [
    '목표: [구체적인 목표]를 달성하기 위해',
    '이 작업의 목적은 [목적 설명]입니다.',
    '[문제/요구사항]을 해결/구현해주세요.',
  ],
  O: [
    '결과물: [형식/언어]로 작성해주세요.',
    '출력 형식: [마크다운/JSON/코드] 형태로',
    '응답에 [포함할 내용]을 포함해주세요.',
  ],
  L: [
    '제약조건: [라이브러리/버전] 사용',
    '주의: [피해야 할 것]은 사용하지 마세요.',
    '제한: [길이/성능] 요구사항을 지켜주세요.',
  ],
  D: [
    '현재 상황: [코드/데이터 설명]',
    '에러 내용: [에러 메시지]',
    '예시 입력: [입력 데이터]',
  ],
  E: [
    '성공 기준: [테스트/기대 결과]를 만족해야 합니다.',
    '검증 방법: [확인 방법]으로 테스트할 수 있어야 합니다.',
    '품질 요구: [성능/정확도] 기준을 충족해야 합니다.',
  ],
  N: [
    '다음 단계: 이후 [계획]을 진행할 예정입니다.',
    '맥락: 이 작업은 [전체 프로젝트]의 일부입니다.',
    '확장 계획: 향후 [기능]을 추가할 예정입니다.',
  ],
};

interface ActionTip {
  dimension: GoldenDimension;
  score: number;
  scoreKey: keyof GoldenScores;
  templates: string[];
}

/**
 * GOLDEN 점수 기반 액션 팁 컴포넌트
 * 가장 낮은 점수 영역에 대한 구체적 개선 팁과 템플릿 제공
 */
export default function GoldenActionTips({
  scores,
  onInsertTemplate,
  maxTips = 2,
}: GoldenActionTipsProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  // Find lowest scoring dimensions
  const lowestDimensions = useMemo((): ActionTip[] => {
    const scoreEntries = Object.entries(scores) as [keyof GoldenScores, number][];

    // Sort by score ascending (lowest first)
    const sorted = scoreEntries.sort((a, b) => a[1] - b[1]);

    // Take top maxTips lowest scores (below 70%)
    return sorted
      .filter(([, score]) => score < 70)
      .slice(0, maxTips)
      .map(([key, score]) => {
        const goldenKey = SCORE_TO_GOLDEN[key];
        const dimension = GOLDEN_EXPLANATIONS[goldenKey];
        return {
          dimension,
          score,
          scoreKey: key,
          templates: INSERTION_TEMPLATES[goldenKey] || [],
        };
      });
  }, [scores, maxTips]);

  // Handle template insertion
  const handleInsertTemplate = useCallback((template: string) => {
    if (onInsertTemplate) {
      onInsertTemplate(template);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(template);
    }
    setCopiedTemplate(template);
    setTimeout(() => setCopiedTemplate(null), 2000);
  }, [onInsertTemplate]);

  // Toggle dimension expansion
  const toggleDimension = useCallback((key: string) => {
    setExpandedDimension(prev => prev === key ? null : key);
  }, []);

  // Calculate overall score
  const overallScore = useMemo(() => {
    const values = Object.values(scores);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [scores]);

  // If all scores are good, show congratulations
  if (lowestDimensions.length === 0) {
    return (
      <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-400">
          <Check size={16} />
          <span className="text-sm font-medium">프롬프트가 잘 작성되었습니다!</span>
        </div>
        <p className="text-xs text-green-400/70 mt-1">
          모든 GOLDEN 영역이 70% 이상입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-amber-400">
        <Lightbulb size={14} />
        <span className="text-xs font-medium">개선 포인트</span>
        <span className="text-[10px] text-gray-500 ml-auto">
          전체 점수: {overallScore}%
        </span>
      </div>

      {/* Action Tips */}
      {lowestDimensions.map((tip) => (
        <div
          key={tip.dimension.key}
          className="bg-dark-surface rounded-lg border border-dark-border overflow-hidden"
        >
          {/* Tip Header - Clickable */}
          <button
            onClick={() => toggleDimension(tip.dimension.key)}
            className="w-full flex items-center gap-2 p-3 hover:bg-dark-hover transition-colors text-left"
          >
            {/* Score indicator */}
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                tip.score < 40
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {tip.dimension.key}
            </div>

            {/* Tip content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200 font-medium">
                  {tip.dimension.name}
                </span>
                <span className={`text-xs ${
                  tip.score < 40 ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {tip.score}%
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate">
                {tip.dimension.improvement}
              </p>
            </div>

            {/* Expand indicator */}
            <div className="text-gray-500">
              {expandedDimension === tip.dimension.key ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </div>
          </button>

          {/* Expanded templates */}
          {expandedDimension === tip.dimension.key && (
            <div className="px-3 pb-3 space-y-2 border-t border-dark-border/50 pt-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                빠른 삽입 템플릿
              </p>
              {tip.templates.map((template, i) => (
                <button
                  key={i}
                  onClick={() => handleInsertTemplate(template)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all ${
                    copiedTemplate === template
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-dark-hover hover:bg-dark-border text-gray-300'
                  }`}
                >
                  {copiedTemplate === template ? (
                    <Check size={12} className="flex-shrink-0" />
                  ) : (
                    <Plus size={12} className="flex-shrink-0 text-gray-500" />
                  )}
                  <span className="truncate">{template}</span>
                </button>
              ))}

              {/* Detailed explanation */}
              <div className="mt-2 p-2 bg-dark-bg rounded-lg">
                <p className="text-[10px] text-gray-400">
                  💡 {tip.dimension.detail}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tip.dimension.examples.map((example, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-dark-hover text-[10px] text-gray-500 rounded"
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Quick action hint */}
      <p className="text-[10px] text-gray-500 text-center pt-1">
        클릭하여 템플릿을 클립보드에 복사
      </p>
    </div>
  );
}
