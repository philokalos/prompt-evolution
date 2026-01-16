/**
 * Improvement Impact Component
 * Phase 3: Track and visualize improvement streaks and their impact
 */

import { useState, useEffect } from 'react';
import { TrendingUp, Award, Calendar, BarChart2 } from 'lucide-react';
import type { ConsecutiveImprovement } from '../electron.d';

export default function ImprovementImpact() {
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

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
        <span className="font-medium">개선 효과 분석</span>
      </div>

      {/* Summary Cards */}
      {improvements.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-success">
                {totalImprovements}
              </div>
              <div className="text-xs text-gray-400">총 개선 횟수</div>
            </div>
            <div className="bg-dark-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-primary">
                +{totalGain}
              </div>
              <div className="text-xs text-gray-400">점수 향상</div>
            </div>
            <div className="bg-dark-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-accent-warning">
                {bestStreak?.improvementCount || 0}
              </div>
              <div className="text-xs text-gray-400">최장 연속 개선</div>
            </div>
          </div>

          {/* Best Streak Highlight */}
          {bestStreak && (
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Award size={24} className="text-green-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-green-400 mb-1">최고 성과</div>
                  <div className="text-sm text-gray-300">
                    {formatDate(bestStreak.startDate)} ~ {formatDate(bestStreak.endDate)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {getDurationDays(bestStreak.startDate, bestStreak.endDate)}일 동안 연속{' '}
                    {bestStreak.improvementCount}회 개선 · 총 +{bestStreak.scoreIncrease}점 향상
                    (평균 +{bestStreak.averageGain}점/일)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Improvement Streaks List */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2 text-gray-400">
              <BarChart2 size={16} />
              <span>개선 기록</span>
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
                          {formatDate(imp.startDate)} ~ {formatDate(imp.endDate)}
                        </span>
                        <span className="text-xs text-gray-500">({duration}일)</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="text-accent-success">
                          연속 {imp.improvementCount}회 개선
                        </span>
                        <span>+{imp.scoreIncrease}점</span>
                        <span className="text-gray-500">평균 +{imp.averageGain}점/일</span>
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
            <div className="text-sm font-medium mb-2">인사이트</div>
            <div className="space-y-2 text-xs text-gray-300">
              {improvements.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-accent-primary">•</span>
                  <span>
                    최근 {improvements.length}번의 개선 기간 동안 평균 {Math.round(totalGain / improvements.length)}점씩 향상되었습니다.
                  </span>
                </div>
              )}
              {bestStreak && (
                <div className="flex items-start gap-2">
                  <span className="text-accent-success">•</span>
                  <span>
                    {formatDate(bestStreak.startDate)}부터 {getDurationDays(bestStreak.startDate, bestStreak.endDate)}일간
                    꾸준히 개선하여 가장 좋은 성과를 냈습니다.
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-accent-warning">•</span>
                <span>
                  일관된 개선을 위해 매일 프롬프트 작성 팁을 확인하고 적용해보세요.
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <TrendingUp size={48} className="mb-4 opacity-50" />
          <p>아직 개선 기록이 없습니다</p>
          <p className="text-sm mt-2">매일 프롬프트를 작성하면 성장 패턴을 볼 수 있습니다</p>
        </div>
      )}
    </div>
  );
}
