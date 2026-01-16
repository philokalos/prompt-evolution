import React, { useState, useCallback, useEffect } from 'react';
import { OnboardingStep } from './OnboardingStep';
import { PartyPopper, Check, X, Keyboard, Shield, FolderOpen, Sparkles, Key } from 'lucide-react';

interface CompleteStepProps {
  hasAccessibility: boolean;
  hotkeyVerified: boolean;
}

/**
 * Complete step showing setup summary and API key option
 */
export function CompleteStep({ hasAccessibility, hotkeyVerified }: CompleteStepProps): React.ReactElement {
  const [shortcut, setShortcut] = useState('Cmd+Shift+P');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const settings = await window.electronAPI.getSettings();

        // Format shortcut
        const configuredShortcut = settings.shortcut as string;
        if (configuredShortcut) {
          const formatted = configuredShortcut
            .replace('CommandOrControl', 'Cmd')
            .replace('Control', 'Ctrl')
            .replace('Shift', '⇧')
            .replace(/\+/g, ' + ');
          setShortcut(formatted);
        }

        // Check if API key exists
        const apiKey = settings.claudeApiKey as string;
        setHasApiKey(!!apiKey && apiKey.length > 0);
      } catch (error) {
        console.error('[Onboarding] Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Handle API key save
  const handleSaveApiKey = useCallback(async (): Promise<void> => {
    if (!apiKeyInput.trim()) return;

    setIsSaving(true);
    try {
      await window.electronAPI.setSetting('claudeApiKey', apiKeyInput.trim());
      await window.electronAPI.setSetting('useAiRewrite', true);
      setHasApiKey(true);
      setShowApiKeyInput(false);
      setApiKeyInput('');
    } catch (error) {
      console.error('[Onboarding] Failed to save API key:', error);
    } finally {
      setIsSaving(false);
    }
  }, [apiKeyInput]);

  return (
    <OnboardingStep
      icon={<PartyPopper className="w-12 h-12 text-yellow-400" />}
      title="준비 완료!"
      subtitle="PromptLint를 사용할 준비가 되었습니다"
    >
      <div className="space-y-4">
        {/* Setup status checklist */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 space-y-3">
          <p className="text-sm text-gray-400 mb-2">설정 상태:</p>

          {/* Hotkey status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                hotkeyVerified ? 'bg-green-500/20' : 'bg-yellow-500/20'
              }`}
            >
              {hotkeyVerified ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Keyboard className="w-4 h-4 text-yellow-400" />
              )}
            </div>
            <span className="text-sm text-white">글로벌 핫키: {shortcut}</span>
          </div>

          {/* Accessibility status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                hasAccessibility ? 'bg-green-500/20' : 'bg-yellow-500/20'
              }`}
            >
              {hasAccessibility ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <X className="w-4 h-4 text-yellow-400" />
              )}
            </div>
            <span className="text-sm text-white">
              접근성 권한: {hasAccessibility ? '허용됨' : '클립보드 모드'}
            </span>
          </div>

          {/* Project detection */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20">
              <FolderOpen className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-white">프로젝트 감지: 활성화</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700" />

        {/* AI feature section */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">AI 개선 기능 (선택)</span>
          </div>

          {hasApiKey ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check className="w-4 h-4" />
              <span>API 키 설정됨 - AI 개선 활성화</span>
            </div>
          ) : showApiKeyInput ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Claude API 키를 입력하면 더 정교한 프롬프트 개선이 가능합니다
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim() || isSaving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isSaving ? '...' : '저장'}
                </button>
              </div>
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="text-xs text-gray-500 hover:text-gray-400"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Claude API를 연결하면 더 정교한 프롬프트 개선이 가능합니다
                <br />
                (~83% 개선율, 규칙 기반 대비 +12%)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="flex-1 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  API 키 설정하기
                </button>
                <button className="px-4 py-2 text-gray-500 hover:text-gray-400 text-sm transition-colors">
                  나중에
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-sm text-gray-400 mb-2">💡 시작 팁:</p>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>프롬프트를 작성하거나 선택하세요</li>
            <li>{shortcut}를 누르세요</li>
            <li>개선된 버전을 확인하고 적용하세요</li>
          </ol>
        </div>
      </div>
    </OnboardingStep>
  );
}
