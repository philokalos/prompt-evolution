/**
 * Learning Insights Component
 * Phase 3: Personalized learning patterns and predictive analytics
 */

import { useState, useEffect } from 'react';
import { Brain, Target, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import type { CategoryPerformance, PredictedScore } from '../electron.d';

const CATEGORY_LABELS: Record<string, string> = {
  'code-generation': '코드 생성',
  'code-review': '코드 리뷰',
  'bug-fix': '버그 수정',
  'refactoring': '리팩토링',
  'explanation': '설명/질문',
  'documentation': '문서화',
  'testing': '테스트',
  'architecture': '아키텍처',
  'deployment': '배포',
  'data-analysis': '데이터 분석',
  'general': '일반',
};

export default function LearningInsights() {
  const [categoryPerf, setCategoryPerf] = useState<CategoryPerformance[]>([]);
  const [prediction, setPrediction] = useState<PredictedScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const [perfData, predData] = await Promise.all([
        window.electronAPI.getCategoryPerformance(),
        window.electronAPI.getPredictedScore(7),
      ]);
      setCategoryPerf(perfData);
      setPrediction(predData);
    } catch (error) {
      console.error('Failed to load learning insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={14} className="text-green-400" />;
      case 'declining':
        return <TrendingUp size={14} className="text-red-400 rotate-180" />;
      default:
        return <span className="text-xs text-gray-500">—</span>;
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    const labels = {
      high: '높음',
      medium: '중간',
      low: '낮음',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[confidence]}`}>
        신뢰도: {labels[confidence]}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  const strengths = categoryPerf.filter(c => c.averageScore >= 75);
  const weaknesses = categoryPerf.filter(c => c.averageScore < 60);
  const improving = categoryPerf.filter(c => c.trend === 'improving');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain size={20} className="text-accent-primary" />
        <span className="font-medium">학습 인사이트</span>
      </div>

      {/* Prediction Card */}
      {prediction && (
        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={24} className="text-purple-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <div className="font-medium text-purple-400 mb-1">다음 프롬프트 예상 점수</div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-3xl font-bold ${getScoreColor(prediction.predictedScore)}`}>
                  {prediction.predictedScore}
                </span>
                <span className="text-sm text-gray-400">점</span>
                {prediction.trend !== 0 && (
                  <span className={`text-sm ${prediction.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ({prediction.trend > 0 ? '+' : ''}{prediction.trend})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getConfidenceBadge(prediction.confidence)}
                {prediction.confidence === 'high' && (
                  <span className="text-xs text-gray-400">
                    최근 7일 데이터 기반 예측
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Performance Overview */}
      {categoryPerf.length > 0 ? (
        <>
          {/* Strengths and Weaknesses */}
          <div className="grid grid-cols-2 gap-3">
            {/* Strengths */}
            <div className="bg-dark-surface rounded-lg p-3 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-green-400">
                <Target size={16} />
                <span>강점 영역</span>
              </div>
              {strengths.length > 0 ? (
                <div className="space-y-1">
                  {strengths.slice(0, 3).map((cat) => (
                    <div key={cat.category} className="text-xs text-gray-300">
                      {CATEGORY_LABELS[cat.category] || cat.category} ({cat.averageScore}점)
                    </div>
                  ))}
                  {strengths.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{strengths.length - 3}개 더
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500">아직 없음</div>
              )}
            </div>

            {/* Weaknesses */}
            <div className="bg-dark-surface rounded-lg p-3 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-red-400">
                <Target size={16} />
                <span>개선 필요</span>
              </div>
              {weaknesses.length > 0 ? (
                <div className="space-y-1">
                  {weaknesses.slice(0, 3).map((cat) => (
                    <div key={cat.category} className="text-xs text-gray-300">
                      {CATEGORY_LABELS[cat.category] || cat.category} ({cat.averageScore}점)
                    </div>
                  ))}
                  {weaknesses.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{weaknesses.length - 3}개 더
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500">좋은 상태입니다</div>
              )}
            </div>
          </div>

          {/* Improving Categories */}
          {improving.length > 0 && (
            <div className="bg-dark-surface rounded-lg p-4 border border-green-500/30">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-green-400">
                <TrendingUp size={16} />
                <span>개선 중인 영역</span>
              </div>
              <div className="space-y-2">
                {improving.map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300">
                      {CATEGORY_LABELS[cat.category] || cat.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={getScoreColor(cat.averageScore)}>
                        {cat.averageScore}점
                      </span>
                      <TrendingUp size={14} className="text-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Category Performance */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-400">카테고리별 성과</div>
            {categoryPerf.map((cat) => (
              <div
                key={cat.category}
                className="bg-dark-surface rounded-lg p-3 border border-gray-700/30 hover:border-accent-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {CATEGORY_LABELS[cat.category] || cat.category}
                    </span>
                    <span className="text-xs text-gray-500">({cat.count}회)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(cat.trend)}
                    <span className={`text-sm font-medium ${getScoreColor(cat.averageScore)}`}>
                      {cat.averageScore}점
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>최고: {cat.bestScore}점</span>
                    {cat.commonWeakness && (
                      <span className="text-orange-400">
                        약점: {cat.commonWeakness}
                      </span>
                    )}
                  </div>
                  {cat.averageScore < cat.bestScore && (
                    <span className="text-gray-500">
                      +{cat.bestScore - cat.averageScore}점 여유
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-dark-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cat.averageScore >= 80
                        ? 'bg-green-500'
                        : cat.averageScore >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${cat.averageScore}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Learning Path Suggestions */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-blue-400">
              <ChevronRight size={16} />
              <span>추천 학습 경로</span>
            </div>
            <div className="space-y-2 text-xs text-gray-300">
              {weaknesses.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">1.</span>
                  <span>
                    {CATEGORY_LABELS[weaknesses[0].category] || weaknesses[0].category}{' '}
                    작업에서 {weaknesses[0].commonWeakness || 'GOLDEN 프레임워크'}를 집중적으로 연습해보세요
                  </span>
                </div>
              )}
              {strengths.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">2.</span>
                  <span>
                    {CATEGORY_LABELS[strengths[0].category] || strengths[0].category}에서의{' '}
                    강점을 다른 영역에도 적용해보세요
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-blue-400">{weaknesses.length > 0 ? '3.' : '1.'}</span>
                <span>
                  매일 일정한 시간에 프롬프트를 작성하면 꾸준한 성장을 이룰 수 있습니다
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Brain size={48} className="mb-4 opacity-50" />
          <p>아직 학습 데이터가 충분하지 않습니다</p>
          <p className="text-sm mt-2">다양한 유형의 프롬프트를 작성해보세요</p>
        </div>
      )}
    </div>
  );
}
