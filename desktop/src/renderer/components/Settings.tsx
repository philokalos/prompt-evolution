import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Keyboard, Eye, Bell, MousePointer2, Zap, Clipboard, Sparkles, ChevronDown, AlertTriangle } from 'lucide-react';
import ProjectSettings from './ProjectSettings';
import TemplateManager from './TemplateManager';
import ProviderSettings from './ProviderSettings';

interface AppSettings {
  shortcut: string;
  alwaysOnTop: boolean;
  hideOnCopy: boolean;
  showNotifications: boolean;
  captureMode: 'auto' | 'selection' | 'clipboard';
  enableProjectPolling: boolean;
  pollingIntervalMs: number;
  claudeApiKey: string;
  useAiRewrite: boolean;
  // Quick Action mode settings
  quickActionMode: boolean;
  // Innovative activation methods
  enableClipboardWatch: boolean;
  enableAIContextPopup: boolean;
  autoAnalyzeOnCopy: boolean;
  autoShowWindow: boolean;
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
  const [, setSaving] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Section collapse states
  const [showGuide, setShowGuide] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(true);
  const [showBehavior, setShowBehavior] = useState(true);
  const [showSmartFeatures, setShowSmartFeatures] = useState(true);
  const [showProjectTemplates, setShowProjectTemplates] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Phase 4: Project & Templates tab state
  const [projectTemplatesTab, setProjectTemplatesTab] = useState<'project' | 'templates'>('project');
  const [currentProjectPath, setCurrentProjectPath] = useState<string | undefined>();

  // Load settings and version on mount
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      // Load app version
      window.electronAPI.getAppVersion().then(setAppVersion).catch(console.error);
      // Load current project for Phase 4
      window.electronAPI.getCurrentProject().then((project) => {
        if (project && typeof project === 'object' && 'projectPath' in project) {
          setCurrentProjectPath((project as { projectPath: string }).projectPath);
        }
      }).catch(console.error);
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

      // Handle special cases
      if (key === 'quickActionMode') {
        // Resize window when quick action mode is toggled
        window.electronAPI.setWindowCompact(value as boolean);
      }
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
              {/* 🚀 시작하기 Section */}
              <Section
                title="시작하기"
                icon="🚀"
                isOpen={showGettingStarted}
                onToggle={() => setShowGettingStarted(!showGettingStarted)}
              >
                {/* 간단 가이드 (Collapsible) */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center justify-between w-full p-2.5 bg-gradient-to-r from-accent-primary/10 to-purple-500/10 border border-accent-primary/20 rounded-lg hover:bg-accent-primary/5 transition-colors"
                  >
                    <span className="text-sm font-semibold text-accent-primary">간단 가이드</span>
                    <ChevronDown
                      size={16}
                      className={`text-accent-primary transition-transform ${showGuide ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showGuide && (
                    <div className="mt-2 p-3 bg-gradient-to-r from-accent-primary/5 to-purple-500/5 border border-accent-primary/10 rounded-lg space-y-2">
                      <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
                        <li>분석하고 싶은 프롬프트를 <strong>드래그</strong>하거나 <strong>복사</strong>합니다</li>
                        <li>아래 설정된 <strong>시작 키</strong>를 누릅니다</li>
                        <li>GOLDEN 점수와 <strong>개선된 프롬프트 3종</strong>을 확인합니다</li>
                        <li>마음에 드는 버전의 <strong>[복사]</strong> 또는 <strong>[적용]</strong> 버튼을 클릭합니다</li>
                      </ol>
                      <div className="pt-2 border-t border-accent-primary/10 space-y-1">
                        <p className="text-xs text-gray-300">
                          <strong className="text-purple-400">트레이 더블클릭</strong>: 클립보드 내용 즉시 분석
                        </p>
                        <p className="text-xs text-gray-400">
                          • <kbd className="px-1 bg-dark-hover rounded text-[10px]">⌘</kbd> + <kbd className="px-1 bg-dark-hover rounded text-[10px]">Enter</kbd> = 현재 선택된 개선안 적용
                        </p>
                        <p className="text-xs text-gray-400">
                          • <kbd className="px-1 bg-dark-hover rounded text-[10px]">⌘</kbd> + <kbd className="px-1 bg-dark-hover rounded text-[10px]">1-4</kbd> = 개선안 복사
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 시작 키 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Keyboard size={14} />
                    시작 키
                    <span className="ml-auto px-2 py-0.5 bg-accent-primary/20 text-accent-primary text-xs rounded">
                      {AVAILABLE_SHORTCUTS.find(s => s.value === settings.shortcut)?.label}
                    </span>
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
                    변경 후 앱을 재시작해야 적용됩니다. 충돌 시 "권장" 단축키를 선택하세요.
                  </p>
                </div>

                {/* 텍스트 가져오기 방식 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <MousePointer2 size={14} />
                    텍스트 가져오기 방식
                  </label>
                  <select
                    value={settings.captureMode}
                    onChange={(e) => updateSetting('captureMode', e.target.value as 'auto' | 'selection' | 'clipboard')}
                    className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  >
                    <option value="auto">자동 (드래그 → 복사본)</option>
                    <option value="selection">드래그한 텍스트만</option>
                    <option value="clipboard">복사한 내용만</option>
                  </select>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong className="text-gray-400">자동:</strong> 드래그한 텍스트를 우선 분석하고, 없으면 클립보드 내용 사용</p>
                    <p><strong className="text-gray-400">드래그만:</strong> 마우스로 선택한 텍스트만 분석 (Cmd+C 불필요)</p>
                    <p><strong className="text-gray-400">복사만:</strong> Cmd+C로 복사한 후 시작 키를 눌러야 합니다</p>
                  </div>
                </div>
              </Section>

              {/* ⚙️ 동작 설정 Section */}
              <Section
                title="동작 설정"
                icon="⚙️"
                isOpen={showBehavior}
                onToggle={() => setShowBehavior(!showBehavior)}
              >
                {/* 창 동작 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">창 동작</h4>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-gray-400" />
                        <span className="text-sm">항상 위에 표시</span>
                      </div>
                      <span className="text-xs text-gray-500">다른 창 위에 분석 창이 항상 보이도록 유지</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.alwaysOnTop}
                      onChange={(v) => updateSetting('alwaysOnTop', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-gray-400" />
                        <span className="text-sm">복사하면 자동으로 닫기</span>
                      </div>
                      <span className="text-xs text-gray-500">개선된 프롬프트를 복사하면 창이 자동으로 닫힘</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.hideOnCopy}
                      onChange={(v) => updateSetting('hideOnCopy', v)}
                    />
                  </div>

                  {/* 설정 충돌 경고 */}
                  {settings.alwaysOnTop && settings.hideOnCopy && (
                    <div className="flex items-start gap-2 p-2 mt-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-yellow-500/90">
                        &ldquo;항상 위에 표시&rdquo;와 &ldquo;복사하면 자동으로 닫기&rdquo;가 동시에 활성화되어 있습니다.
                        복사 후 창이 닫히면 다시 열 때까지 다른 앱 위에 표시되지 않습니다.
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-gray-400" />
                        <span className="text-sm">분석 완료 시 자동으로 열기</span>
                      </div>
                      <span className="text-xs text-gray-500">분석이 끝나면 창을 자동으로 표시</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.autoShowWindow ?? true}
                      onChange={(v) => updateSetting('autoShowWindow', v)}
                    />
                  </div>
                </div>

                {/* 알림 */}
                <div className="pt-3 border-t border-dark-border">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-gray-400" />
                        <span className="text-sm">알림 받기</span>
                      </div>
                      <span className="text-xs text-gray-500">분석 완료, 오류 등을 macOS 알림으로 안내</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.showNotifications}
                      onChange={(v) => updateSetting('showNotifications', v)}
                    />
                  </div>
                </div>
              </Section>

              {/* ✨ 똑똑한 기능 Section */}
              <Section
                title="똑똑한 기능"
                icon="✨"
                isOpen={showSmartFeatures}
                onToggle={() => setShowSmartFeatures(!showSmartFeatures)}
              >
                {/* Multi-Provider AI Settings */}
                <ProviderSettings />

                {/* 자동 감지 */}
                <div className="pt-3 border-t border-dark-border space-y-3">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">자동 감지</h4>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Clipboard size={14} className="text-gray-400" />
                        <span className="text-sm">복사할 때 감지</span>
                      </div>
                      <span className="text-xs text-gray-500">프롬프트 복사 시 트레이에 • 표시</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.enableClipboardWatch ?? false}
                      onChange={(v) => updateSetting('enableClipboardWatch', v)}
                    />
                  </div>

                  {settings.enableClipboardWatch && (
                    <div className="flex items-center justify-between py-2 pl-6">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-gray-400" />
                          <span className="text-sm">자동으로 분석</span>
                        </div>
                        <span className="text-xs text-gray-500">감지 즉시 자동 분석 (트레이 클릭 불필요)</span>
                      </div>
                      <ToggleSwitch
                        checked={settings.autoAnalyzeOnCopy ?? false}
                        onChange={(v) => updateSetting('autoAnalyzeOnCopy', v)}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-gray-400" />
                        <span className="text-sm">AI 앱에서 버튼 보기</span>
                      </div>
                      <span className="text-xs text-gray-500">Claude, ChatGPT 사용 시 플로팅 버튼</span>
                      {settings.enableAIContextPopup && (
                        <div className="mt-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
                          ⚠️ 타이핑 중 방해될 수 있으니 필요시에만 활성화
                        </div>
                      )}
                    </div>
                    <ToggleSwitch
                      checked={settings.enableAIContextPopup ?? false}
                      onChange={(v) => updateSetting('enableAIContextPopup', v)}
                    />
                  </div>
                </div>

                {/* 작업 자동 적용 (정보) */}
                <div className="pt-3 border-t border-dark-border">
                  <div className="p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-accent-primary" />
                      <h4 className="text-sm font-medium text-accent-primary">작업 자동 적용</h4>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      <strong>[적용]</strong> 버튼을 누르면 개선된 프롬프트가 원본 앱(Claude, ChatGPT 등)의 입력창에 자동으로 교체됩니다.
                    </p>
                    <p className="text-xs text-gray-500">
                      ※ VS Code, Cursor 등 일부 앱에서는 클립보드 복사 후 수동 붙여넣기 필요
                    </p>
                  </div>
                </div>
              </Section>

              {/* 📁 프로젝트 & 템플릿 Section (Phase 4) */}
              <Section
                title="프로젝트 & 템플릿"
                icon="📁"
                isOpen={showProjectTemplates}
                onToggle={() => setShowProjectTemplates(!showProjectTemplates)}
              >
                {/* Tab Selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setProjectTemplatesTab('project')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      projectTemplatesTab === 'project'
                        ? 'bg-accent-primary text-white'
                        : 'bg-dark-hover text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    프로젝트 설정
                  </button>
                  <button
                    onClick={() => setProjectTemplatesTab('templates')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      projectTemplatesTab === 'templates'
                        ? 'bg-accent-primary text-white'
                        : 'bg-dark-hover text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    템플릿 관리
                  </button>
                </div>

                {/* Tab Content */}
                {projectTemplatesTab === 'project' ? (
                  <ProjectSettings projectPath={currentProjectPath} />
                ) : (
                  <TemplateManager />
                )}
              </Section>

              {/* 🔧 고급 설정 Section */}
              <Section
                title="고급 설정"
                icon="🔧"
                isOpen={showAdvanced}
                onToggle={() => setShowAdvanced(!showAdvanced)}
              >
                {/* 빠른 작업 모드 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-gray-400" />
                        <span className="text-sm">빠른 작업 모드</span>
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded uppercase font-medium">실험적</span>
                      </div>
                      <span className="text-xs text-gray-500">분석 결과 대신 미니 패널만 표시</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.quickActionMode ?? false}
                      onChange={(v) => updateSetting('quickActionMode', v)}
                    />
                  </div>
                </div>
              </Section>

              {/* ℹ️ 앱 정보 */}
              <div className="pt-4 border-t border-dark-border">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>PromptLint v{appVersion || '...'}</p>
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

// Section Component
function Section({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-dark-border pt-4">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full mb-3 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
            {title}
          </h3>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="space-y-4">{children}</div>}
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
