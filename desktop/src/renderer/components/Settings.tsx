import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Keyboard, Eye, Bell, Globe, MousePointer2, Monitor, Key, EyeOff, Zap, Clipboard, Sparkles } from 'lucide-react';

interface AppSettings {
  shortcut: string;
  alwaysOnTop: boolean;
  hideOnCopy: boolean;
  language: 'ko' | 'en';
  showNotifications: boolean;
  captureMode: 'auto' | 'selection' | 'clipboard';
  enableProjectPolling: boolean;
  pollingIntervalMs: number;
  claudeApiKey: string;
  useAiRewrite: boolean;
  // Quick Action mode settings
  quickActionMode: boolean;
  quickActionAutoHide: number;
  // Innovative activation methods
  enableClipboardWatch: boolean;
  enableAIContextPopup: boolean;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available shortcuts (ordered by conflict likelihood: safest first)
const AVAILABLE_SHORTCUTS = [
  { value: 'CommandOrControl+Shift+;', label: '⌘⇧;', desc: '권장 (충돌 최소)' },
  { value: 'Alt+CommandOrControl+P', label: '⌥⌘P', desc: 'P 유지' },
  { value: 'CommandOrControl+Alt+Shift+L', label: 'Hyper+L', desc: '충돌 없음' },
  { value: 'CommandOrControl+Alt+Shift+P', label: 'Hyper+P', desc: '충돌 없음' },
  { value: 'CommandOrControl+Shift+P', label: '⌘⇧P', desc: '기존 (충돌 가능)' },
  { value: 'CommandOrControl+Shift+L', label: '⌘⇧L', desc: '' },
  { value: 'CommandOrControl+Shift+K', label: '⌘⇧K', desc: '' },
];

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [_saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const loaded = await window.electronAPI.getSettings();
      setSettings(loaded as unknown as AppSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;

    setSaving(true);
    try {
      await window.electronAPI.setSetting(key, value);
      setSettings({ ...settings, [key]: value });
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-surface rounded-xl border border-dark-border w-[360px] max-h-[80vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <SettingsIcon size={18} className="text-accent-primary" />
            <span className="font-medium">설정</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover transition-colors"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {settings ? (
            <>
              {/* Shortcut */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Keyboard size={14} />
                  전역 단축키
                </label>
                <select
                  value={settings.shortcut}
                  onChange={(e) => updateSetting('shortcut', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                >
                  {AVAILABLE_SHORTCUTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}{s.desc ? ` - ${s.desc}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  클립보드 분석을 위한 전역 단축키 (변경 후 앱 재시작 필요)
                </p>
                <p className="text-xs text-gray-500">
                  💡 Hyper Key 사용 시{' '}
                  <a
                    href="https://karabiner-elements.pqrs.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-primary hover:underline"
                  >
                    Karabiner-Elements
                  </a>
                  로 Caps Lock을 Hyper Key로 설정 가능
                </p>
              </div>

              {/* Capture Mode */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <MousePointer2 size={14} />
                  캡처 모드
                </label>
                <select
                  value={settings.captureMode}
                  onChange={(e) => updateSetting('captureMode', e.target.value as 'auto' | 'selection' | 'clipboard')}
                  className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                >
                  <option value="auto">자동 (선택 → 클립보드)</option>
                  <option value="selection">선택 텍스트만</option>
                  <option value="clipboard">클립보드만</option>
                </select>
                <p className="text-xs text-gray-500">
                  자동: 선택 텍스트 우선, 없으면 클립보드 사용
                </p>
              </div>

              {/* Project Detection */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Monitor size={14} className="text-gray-400" />
                  <span className="text-sm">활성 프로젝트 감지</span>
                </div>
                <ToggleSwitch
                  checked={settings.enableProjectPolling}
                  onChange={(v) => updateSetting('enableProjectPolling', v)}
                />
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                현재 활성 IDE 창의 프로젝트를 자동으로 감지
              </p>

              {/* Always on Top */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-gray-400" />
                  <span className="text-sm">항상 위에 표시</span>
                </div>
                <ToggleSwitch
                  checked={settings.alwaysOnTop}
                  onChange={(v) => updateSetting('alwaysOnTop', v)}
                />
              </div>

              {/* Hide on Copy */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-gray-400" />
                  <span className="text-sm">복사 후 자동 숨김</span>
                </div>
                <ToggleSwitch
                  checked={settings.hideOnCopy}
                  onChange={(v) => updateSetting('hideOnCopy', v)}
                />
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-gray-400" />
                  <span className="text-sm">알림 표시</span>
                </div>
                <ToggleSwitch
                  checked={settings.showNotifications}
                  onChange={(v) => updateSetting('showNotifications', v)}
                />
              </div>

              {/* Apply Feature Info */}
              <div className="pt-4 border-t border-dark-border space-y-3">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Zap size={14} className="text-accent-primary" />
                  프롬프트 적용 기능
                </h3>

                {/* Info box */}
                <div className="p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-lg space-y-2">
                  <p className="text-xs text-gray-300 leading-relaxed">
                    <strong className="text-accent-primary">[적용]</strong> 버튼을 누르면 개선된 프롬프트가
                    원본 앱(Claude, ChatGPT 등)의 입력창에 자동으로 교체됩니다.
                  </p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>• <kbd className="px-1 bg-dark-hover rounded">⌘</kbd> + <kbd className="px-1 bg-dark-hover rounded">Enter</kbd> = 현재 선택된 개선안 적용</p>
                    <p>• <kbd className="px-1 bg-dark-hover rounded">⌘</kbd> + <kbd className="px-1 bg-dark-hover rounded">1-4</kbd> = 개선안 복사</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  ※ VS Code, Cursor 등 일부 앱에서는 클립보드 복사 후 수동 붙여넣기가 필요합니다
                </p>
              </div>

              {/* Innovative Activation Methods Section */}
              <div className="pt-4 border-t border-dark-border space-y-3">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  혁신적 활성화 방법
                </h3>

                {/* Clipboard Watch Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Clipboard size={14} className="text-gray-400" />
                      <span className="text-sm">클립보드 자동 감지</span>
                    </div>
                    <span className="text-xs text-gray-500">프롬프트 복사 시 트레이에 알림 표시</span>
                  </div>
                  <ToggleSwitch
                    checked={settings.enableClipboardWatch ?? false}
                    onChange={(v) => updateSetting('enableClipboardWatch', v)}
                  />
                </div>

                {/* AI Context Popup Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-gray-400" />
                      <span className="text-sm">AI 앱 컨텍스트 팝업</span>
                    </div>
                    <span className="text-xs text-gray-500">Claude, ChatGPT 사용 시 플로팅 버튼 표시</span>
                  </div>
                  <ToggleSwitch
                    checked={settings.enableAIContextPopup ?? false}
                    onChange={(v) => updateSetting('enableAIContextPopup', v)}
                  />
                </div>

                {/* Info box */}
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-2">
                  <p className="text-xs text-gray-300 leading-relaxed">
                    <strong className="text-purple-400">트레이 더블클릭</strong>: 클립보드 내용 즉시 분석
                  </p>
                  <p className="text-xs text-gray-400">
                    • 싱글클릭 = 창 토글 | 더블클릭 = 클립보드 분석
                  </p>
                  <p className="text-xs text-gray-400">
                    • 클립보드 감지 활성화 시 프롬프트 복사하면 트레이에 • 표시
                  </p>
                </div>
              </div>

              {/* Quick Action Mode Section */}
              <div className="pt-4 border-t border-dark-border space-y-3">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Zap size={14} className="text-amber-400" />
                  퀵액션 모드 (실험적)
                </h3>

                {/* Quick Action Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">퀵액션 모드 사용</span>
                    <span className="text-xs text-gray-500">분석 결과 대신 미니 패널만 표시</span>
                  </div>
                  <ToggleSwitch
                    checked={settings.quickActionMode ?? false}
                    onChange={(v) => updateSetting('quickActionMode', v)}
                  />
                </div>

                {/* Auto-hide timer (only when quickActionMode is enabled) */}
                {settings.quickActionMode && (
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">자동 숨김 시간</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={settings.quickActionAutoHide ?? 3}
                        onChange={(e) => updateSetting('quickActionAutoHide', parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-dark-border rounded-lg appearance-none cursor-pointer accent-accent-primary"
                      />
                      <span className="text-sm text-gray-300 w-12 text-right">
                        {(settings.quickActionAutoHide ?? 3) === 0 ? '비활성' : `${settings.quickActionAutoHide ?? 3}초`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      0 = 자동 숨김 비활성화, 1-5초 자동 숨김
                    </p>
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Globe size={14} />
                  언어
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSetting('language', e.target.value as 'ko' | 'en')}
                  className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* AI Rewrite Section */}
              <div className="pt-4 border-t border-dark-border space-y-4">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Key size={14} className="text-accent-primary" />
                  AI 프롬프트 개선
                </h3>

                {/* Enable AI Rewrite */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">Claude API 사용</span>
                    <span className="text-xs text-gray-500">AI로 더 정확한 프롬프트 개선</span>
                  </div>
                  <ToggleSwitch
                    checked={settings.useAiRewrite}
                    onChange={(v) => updateSetting('useAiRewrite', v)}
                  />
                </div>

                {/* API Key Input */}
                {settings.useAiRewrite && (
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.claudeApiKey}
                        onChange={(e) => updateSetting('claudeApiKey', e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full px-3 py-2 pr-10 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      API 키는 로컬에만 저장되며 외부로 전송되지 않습니다
                    </p>
                  </div>
                )}
              </div>

              {/* App Info */}
              <div className="pt-4 border-t border-dark-border">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>PromptLint v0.1.4</p>
                  <p>© 2025 philokalos</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-primary"></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-dark-border bg-dark-hover/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-dark-surface hover:bg-dark-border rounded-lg text-sm transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent-primary' : 'bg-dark-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
