import React, { useState, useCallback } from 'react';
import { OnboardingStep } from './OnboardingStep';
import { DemoAnalysis } from './DemoAnalysis';
import { Sparkles } from 'lucide-react';

interface WelcomeStepProps {
  onDemoComplete: () => void;
  demoCompleted: boolean;
}

// Sample prompts for demo
const DEMO_PROMPTS = {
  before: '버그 고쳐줘',
  improved:
    '로그인 페이지에서 발생하는 500 에러를 수정해주세요. 에러 로그를 분석하고, 원인을 파악한 후 수정 PR을 작성해주세요.',
};

/**
 * Welcome step with interactive demo
 * Shows before/after comparison to demonstrate value
 */
export function WelcomeStep({ onDemoComplete, demoCompleted }: WelcomeStepProps): React.ReactElement {
  const [showDemo, setShowDemo] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeClick = useCallback(async (): Promise<void> => {
    setIsAnalyzing(true);

    // Simulate analysis delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 1200));

    setShowDemo(true);
    setIsAnalyzing(false);
    onDemoComplete();
  }, [onDemoComplete]);

  return (
    <OnboardingStep
      icon={<Sparkles className="w-12 h-12 text-blue-400" />}
      title="PromptLint"
      subtitle="AI 프롬프트를 더 효과적으로 작성하세요"
    >
      <div className="space-y-6">
        {/* Demo intro text */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-sm text-gray-300 mb-4">💡 지금 바로 체험해보세요</p>

          {/* Before prompt */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Before</label>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <p className="text-white font-mono text-sm">{DEMO_PROMPTS.before}</p>
            </div>
          </div>

          {/* Analyze button (only show if demo not started) */}
          {!showDemo && !demoCompleted && (
            <button
              onClick={handleAnalyzeClick}
              disabled={isAnalyzing}
              className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
                isAnalyzing
                  ? 'bg-blue-600/50 text-blue-200 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                  분석 중...
                </span>
              ) : (
                '분석하기'
              )}
            </button>
          )}
        </div>

        {/* Demo results (show after analysis) */}
        {(showDemo || demoCompleted) && (
          <DemoAnalysis beforePrompt={DEMO_PROMPTS.before} improvedPrompt={DEMO_PROMPTS.improved} />
        )}
      </div>
    </OnboardingStep>
  );
}
