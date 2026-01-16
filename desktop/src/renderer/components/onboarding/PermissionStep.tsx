import React, { useCallback } from 'react';
import { OnboardingStep } from './OnboardingStep';
import { Shield, Check, Clipboard, MousePointer, Settings } from 'lucide-react';

interface PermissionStepProps {
  hasAccessibility: boolean;
}

/**
 * Permission step explaining accessibility requirements
 * Provides button to open system settings
 */
export function PermissionStep({ hasAccessibility }: PermissionStepProps): React.ReactElement {
  const handleOpenSettings = useCallback(async (): Promise<void> => {
    try {
      await window.electronAPI.openAccessibilitySettings();
    } catch (error) {
      console.error('[Onboarding] Failed to open settings:', error);
    }
  }, []);

  return (
    <OnboardingStep
      icon={<Shield className="w-12 h-12 text-yellow-400" />}
      title="권한 설정"
      subtitle="텍스트 선택 기능을 위해 접근성 권한이 필요합니다"
    >
      <div className="space-y-4">
        {/* Permission options comparison */}
        <div className="grid grid-cols-1 gap-3">
          {/* With permission */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-white">권한이 있으면</span>
            </div>
            <ul className="text-xs text-gray-400 space-y-1 ml-6">
              <li>• 텍스트 선택 → 핫키 → 즉시 분석</li>
              <li>• 모든 앱에서 빠르게 사용 가능</li>
            </ul>
          </div>

          {/* Without permission */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Clipboard className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">권한 없이도</span>
            </div>
            <ul className="text-xs text-gray-400 space-y-1 ml-6">
              <li>• 클립보드 복사(Cmd+C) → 핫키 → 분석</li>
              <li>• 기본 기능 모두 사용 가능</li>
            </ul>
          </div>
        </div>

        {/* Current status */}
        <div
          className={`rounded-lg p-4 border ${
            hasAccessibility
              ? 'bg-green-900/20 border-green-700/50'
              : 'bg-yellow-900/20 border-yellow-700/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {hasAccessibility ? (
              <>
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">권한 허용됨</span>
              </>
            ) : (
              <>
                <Settings className="w-5 h-5 text-yellow-400 animate-pulse" />
                <span className="text-yellow-400 font-medium">권한 필요</span>
              </>
            )}
          </div>

          {hasAccessibility ? (
            <p className="text-sm text-green-300">
              🎉 텍스트 선택 기능이 활성화되었습니다!
            </p>
          ) : (
            <>
              <button
                onClick={handleOpenSettings}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                시스템 설정 열기
              </button>
              <p className="text-xs text-gray-400 mt-3 text-center">
                설정에서 PromptLint를 체크하면 자동으로 다음 단계로 이동합니다
              </p>
            </>
          )}
        </div>

        {/* Skip note */}
        {!hasAccessibility && (
          <p className="text-xs text-gray-500 text-center">
            💡 권한 없이도 클립보드 모드로 사용할 수 있습니다
          </p>
        )}
      </div>
    </OnboardingStep>
  );
}
