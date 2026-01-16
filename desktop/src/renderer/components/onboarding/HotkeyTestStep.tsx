import React, { useEffect, useState } from 'react';
import { OnboardingStep } from './OnboardingStep';
import { Keyboard, Check, Loader } from 'lucide-react';

interface HotkeyTestStepProps {
  onVerified: () => void;
  verified: boolean;
}

/**
 * Hotkey test step
 * Listens for hotkey press and shows success state
 */
export function HotkeyTestStep({ onVerified, verified }: HotkeyTestStepProps): React.ReactElement {
  const [shortcut, setShortcut] = useState('Cmd+Shift+P');
  const [isWaiting, setIsWaiting] = useState(true);

  // Get current shortcut from settings
  useEffect(() => {
    const loadShortcut = async (): Promise<void> => {
      try {
        const settings = await window.electronAPI.getSettings();
        const configuredShortcut = settings.shortcut as string;
        if (configuredShortcut) {
          // Format for display
          const formatted = configuredShortcut
            .replace('CommandOrControl', 'Cmd')
            .replace('Control', 'Ctrl')
            .replace('Shift', '⇧')
            .replace(/\+/g, ' + ');
          setShortcut(formatted);
        }
      } catch (error) {
        console.error('[Onboarding] Failed to load shortcut:', error);
      }
    };
    loadShortcut();
  }, []);

  // Listen for hotkey press (clipboard-text event indicates hotkey was pressed)
  useEffect(() => {
    if (verified) return;

    const handleClipboardText = (): void => {
      console.log('[Onboarding] Hotkey detected!');
      setIsWaiting(false);
      onVerified();
    };

    // Also listen for empty-state (hotkey pressed but no text)
    const handleEmptyState = (): void => {
      console.log('[Onboarding] Hotkey detected (empty state)!');
      setIsWaiting(false);
      onVerified();
    };

    window.electronAPI.onClipboardText(handleClipboardText);
    window.electronAPI.onEmptyState(handleEmptyState);

    return () => {
      window.electronAPI.removeClipboardListener();
      window.electronAPI.removeEmptyStateListener();
    };
  }, [verified, onVerified]);

  return (
    <OnboardingStep
      icon={<Keyboard className="w-12 h-12 text-purple-400" />}
      title="핫키 테스트"
      subtitle="어디서든 프롬프트를 분석할 수 있습니다"
    >
      <div className="space-y-6">
        {/* Hotkey display */}
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-400 mb-4">지금 눌러보세요:</p>

          <div
            className={`px-8 py-6 rounded-xl border-2 transition-all duration-300 ${
              verified
                ? 'bg-green-900/30 border-green-500'
                : isWaiting
                ? 'bg-gray-800/50 border-gray-600 animate-pulse'
                : 'bg-gray-800/50 border-gray-600'
            }`}
          >
            {verified ? (
              <div className="flex items-center gap-3">
                <Check className="w-8 h-8 text-green-400" />
                <span className="text-xl font-bold text-green-400">핫키 동작 확인!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isWaiting && <Loader className="w-5 h-5 text-gray-400 animate-spin" />}
                <span className="text-2xl font-mono font-bold text-white">{shortcut}</span>
              </div>
            )}
          </div>

          {/* Status text */}
          <p className="text-sm text-gray-400 mt-4">
            {verified ? (
              <span className="text-green-400">🎉 어디서든 {shortcut}로 분석할 수 있습니다</span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                키 입력 대기 중...
              </span>
            )}
          </p>
        </div>

        {/* Tip */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400">
            💡 다른 앱에서도 이 단축키로 PromptLint를 호출할 수 있습니다. 텍스트를 선택하고 단축키를
            누르면 자동으로 분석됩니다.
          </p>
        </div>
      </div>
    </OnboardingStep>
  );
}
