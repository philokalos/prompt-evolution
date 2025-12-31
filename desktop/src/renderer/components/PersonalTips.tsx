import { useState, useEffect } from 'react';
import { Lightbulb, AlertCircle, TrendingUp, BookOpen } from 'lucide-react';

interface Weakness {
  type: string;
  frequency: number;
  lastSeen: Date;
}

interface PersonalTipsProps {
  currentTips?: string[];
  className?: string;
}

// GOLDEN dimension improvement suggestions
const GOLDEN_TIPS: Record<string, { icon: string; tips: string[] }> = {
  '목표 명확성': {
    icon: '🎯',
    tips: [
      '"목표: [구체적인 목표]"로 시작하세요',
      '달성하고자 하는 결과를 명확히 명시하세요',
      '성공 조건을 정의해보세요',
    ],
  },
  '출력 형식': {
    icon: '📋',
    tips: [
      '원하는 출력 형식을 명시하세요 (JSON, 마크다운, 코드 등)',
      '예시 출력을 포함하면 더 정확한 결과를 얻을 수 있어요',
      '응답 길이나 상세도 수준을 지정해보세요',
    ],
  },
  '제약 조건': {
    icon: '🚧',
    tips: [
      '하지 말아야 할 것을 명시하세요',
      '범위나 한계를 정의해보세요',
      '기술적 제약사항이 있다면 언급하세요',
    ],
  },
  '데이터/컨텍스트': {
    icon: '📊',
    tips: [
      '필요한 배경 정보를 제공하세요',
      '관련 코드나 문서를 포함하세요',
      '현재 상황이나 환경을 설명해보세요',
    ],
  },
  '평가 기준': {
    icon: '✅',
    tips: [
      '좋은 답변의 기준을 정의해보세요',
      '우선순위가 있다면 언급하세요',
      '품질 측정 방법을 제시해보세요',
    ],
  },
  '다음 단계': {
    icon: '➡️',
    tips: [
      '후속 작업이 있다면 언급하세요',
      '예상되는 다음 질문을 미리 고려해보세요',
      '워크플로우의 일부라면 맥락을 제공하세요',
    ],
  },
};

export default function PersonalTips({ currentTips, className = '' }: PersonalTipsProps) {
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeaknesses();
  }, []);

  const loadWeaknesses = async () => {
    try {
      const data = await window.electronAPI.getTopWeaknesses(3);
      setWeaknesses(data as Weakness[]);
    } catch (error) {
      console.error('Failed to load weaknesses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-dark-surface rounded-lg p-4 ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-dark-hover rounded w-1/3"></div>
          <div className="h-3 bg-dark-hover rounded w-full"></div>
          <div className="h-3 bg-dark-hover rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  // Combine current tips with weakness-based tips
  const allTips = [...(currentTips || [])];

  // Add tips based on weaknesses
  weaknesses.forEach((weakness) => {
    const goldenTip = GOLDEN_TIPS[weakness.type];
    if (goldenTip && goldenTip.tips[0]) {
      allTips.push(`${goldenTip.icon} ${goldenTip.tips[0]}`);
    }
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Current Tips Section */}
      {allTips.length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Lightbulb size={16} className="text-accent-primary" />
            <span>맞춤 팁</span>
          </div>
          <div className="space-y-2">
            {allTips.slice(0, 4).map((tip, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="text-accent-secondary">•</span>
                <span className="text-gray-300">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weakness Patterns Section */}
      {weaknesses.length > 0 && (
        <div className="bg-dark-surface rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <AlertCircle size={16} className="text-accent-warning" />
            <span>자주 놓치는 부분</span>
          </div>
          <div className="space-y-3">
            {weaknesses.map((weakness, index) => {
              const goldenTip = GOLDEN_TIPS[weakness.type];
              return (
                <div key={index} className="border-l-2 border-accent-warning/50 pl-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {goldenTip?.icon || '📝'} {weakness.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {weakness.frequency}회 발견
                    </span>
                  </div>
                  {goldenTip && (
                    <p className="text-xs text-gray-400 mt-1">
                      {goldenTip.tips[Math.floor(Math.random() * goldenTip.tips.length)]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Improvement Tips */}
      <div className="bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 rounded-lg p-4 border border-accent-primary/20">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <TrendingUp size={16} className="text-accent-success" />
          <span>실력 향상 팁</span>
        </div>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• 프롬프트를 작성하기 전에 목표를 명확히 정리하세요</p>
          <p>• 예시를 포함하면 원하는 결과를 더 정확히 얻을 수 있어요</p>
          <p>• 복잡한 작업은 단계별로 나누어 요청해보세요</p>
        </div>
      </div>

      {/* Learning Resources */}
      <button className="w-full flex items-center justify-center gap-2 p-3 bg-dark-hover hover:bg-dark-border rounded-lg text-sm transition-colors">
        <BookOpen size={16} />
        <span>프롬프트 작성 가이드 보기</span>
      </button>
    </div>
  );
}
