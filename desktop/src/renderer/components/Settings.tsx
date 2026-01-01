import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Keyboard, Eye, Bell, Globe, MousePointer2 } from 'lucide-react';

interface AppSettings {
  shortcut: string;
  alwaysOnTop: boolean;
  hideOnCopy: boolean;
  language: 'ko' | 'en';
  showNotifications: boolean;
  captureMode: 'auto' | 'selection' | 'clipboard';
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Shortcut display mapping
const SHORTCUT_DISPLAY: Record<string, string> = {
  'CommandOrControl+Shift+P': '⌘⇧P',
  'CommandOrControl+Shift+L': '⌘⇧L',
  'CommandOrControl+Shift+K': '⌘⇧K',
};

// Available shortcuts
const AVAILABLE_SHORTCUTS = [
  { value: 'CommandOrControl+Shift+P', label: '⌘⇧P' },
  { value: 'CommandOrControl+Shift+L', label: '⌘⇧L' },
  { value: 'CommandOrControl+Shift+K', label: '⌘⇧K' },
];

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const loaded = await window.electronAPI.getSettings();
      setSettings(loaded as AppSettings);
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
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  클립보드 분석을 위한 전역 단축키 (변경 후 앱 재시작 필요)
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
