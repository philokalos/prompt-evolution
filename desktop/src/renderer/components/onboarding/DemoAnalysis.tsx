import React from 'react';
import { Target, CheckCircle, TrendingUp } from 'lucide-react';

interface DemoAnalysisProps {
  beforePrompt: string;
  improvedPrompt: string;
}

// Simulated GOLDEN scores for demo
const DEMO_SCORES = {
  before: { goal: 0.3, output: 0.2, limits: 0.1, data: 0.1, evaluation: 0.2, next: 0.1 },
  after: { goal: 0.9, output: 0.8, limits: 0.6, data: 0.7, evaluation: 0.8, next: 0.7 },
};

/**
 * Demo analysis result showing before/after comparison
 */
export function DemoAnalysis({ beforePrompt, improvedPrompt }: DemoAnalysisProps): React.ReactElement {
  // Calculate improvement percentage
  const beforeAvg = Object.values(DEMO_SCORES.before).reduce((a, b) => a + b, 0) / 6;
  const afterAvg = Object.values(DEMO_SCORES.after).reduce((a, b) => a + b, 0) / 6;
  const improvementPercent = Math.round(((afterAvg - beforeAvg) / beforeAvg) * 100);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Score comparison */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-red-400" />
          <span className="text-sm text-gray-300">가장 개선이 필요한 영역</span>
        </div>

        {/* Goal score bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">🎯 Goal</span>
            <span className="text-red-400">{DEMO_SCORES.before.goal.toFixed(1)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${DEMO_SCORES.before.goal * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">→ 목표가 불명확합니다</p>
        </div>
      </div>

      {/* Improved prompt */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-green-800/50">
        <label className="text-xs text-green-400 uppercase tracking-wide mb-2 block flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          After
        </label>
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
          <p className="text-white text-sm leading-relaxed">{improvedPrompt}</p>
        </div>

        {/* New score bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">🎯 Goal</span>
            <span className="text-green-400">{DEMO_SCORES.after.goal.toFixed(1)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${DEMO_SCORES.after.goal * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Improvement summary */}
      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-lg p-4 border border-green-700/50">
        <div className="flex items-center justify-center gap-2 text-green-400">
          <TrendingUp className="w-5 h-5" />
          <span className="text-lg font-bold">프롬프트 품질 {improvementPercent}% 향상!</span>
        </div>
        <p className="text-center text-sm text-gray-400 mt-2">
          이렇게 프롬프트를 개선해드립니다
        </p>
      </div>
    </div>
  );
}
