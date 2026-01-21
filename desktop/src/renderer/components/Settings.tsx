import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Keyboard, Eye, Bell, MousePointer2, Zap, Clipboard, Sparkles, ChevronDown, AlertTriangle, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProjectSettings from './ProjectSettings';
import TemplateManager from './TemplateManager';
import ProviderSettings from './ProviderSettings';
import { changeLanguage } from '../../locales';

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
  // Language preference
  language: 'auto' | 'en' | 'ko';
}

// Language option values
const LANGUAGE_VALUES = ['auto', 'en', 'ko'] as const;

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available shortcuts (ordered by conflict likelihood: safest first)
// descKey is the translation key suffix under settings:shortcut
const AVAILABLE_SHORTCUTS = [
  { value: 'CommandOrControl+Shift+;', label: '⌘⇧;', descKey: 'recommended' },
  { value: 'Alt+CommandOrControl+P', label: '⌥⌘P', descKey: 'keepP' },
  { value: 'CommandOrControl+Alt+Shift+L', label: 'Hyper+L', descKey: 'noConflict' },
  { value: 'CommandOrControl+Alt+Shift+P', label: 'Hyper+P', descKey: 'noConflict' },
  { value: 'CommandOrControl+Shift+P', label: '⌘⇧P', descKey: 'current' },
  { value: 'CommandOrControl+Shift+L', label: '⌘⇧L', descKey: '' },
  { value: 'CommandOrControl+Shift+K', label: '⌘⇧K', descKey: '' },
];

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
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

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load settings and version on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await window.electronAPI.getSettings();
        setSettings(loaded as unknown as AppSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

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

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;

    try {
      await window.electronAPI.setSetting(key, value);
      setSettings({ ...settings, [key]: value });

      // Show saved feedback
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 2000);

      // Handle special cases
      if (key === 'quickActionMode') {
        // Resize window when quick action mode is toggled
        window.electronAPI.setWindowCompact(value as boolean);
      }
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };

  // Language change handler
  const handleLanguageChange = async (language: 'auto' | 'en' | 'ko') => {
    if (!settings) return;

    try {
      const result = await window.electronAPI.setLanguage(language);
      if (result.success && result.resolvedLanguage) {
        // Update local state
        setSettings({ ...settings, language });

        // Update react-i18next
        await changeLanguage(result.resolvedLanguage as 'en' | 'ko');

        // Show saved feedback
        setShowSavedFeedback(true);
        setTimeout(() => setShowSavedFeedback(false), 2000);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
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
            <span className="font-medium">{t('title')}</span>
            {/* Saved feedback indicator */}
            {showSavedFeedback && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full animate-pulse">
                {t('saved')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover transition-colors"
            aria-label={t('closeAria')}
            title={t('closeHint')}
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {settings ? (
            <>
              {/* 🚀 Getting Started Section */}
              <Section
                title={t('sections.gettingStarted.title')}
                icon="🚀"
                isOpen={showGettingStarted}
                onToggle={() => setShowGettingStarted(!showGettingStarted)}
              >
                {/* Quick Guide (Collapsible) */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center justify-between w-full p-2.5 bg-gradient-to-r from-accent-primary/10 to-purple-500/10 border border-accent-primary/20 rounded-lg hover:bg-accent-primary/5 transition-colors"
                  >
                    <span className="text-sm font-semibold text-accent-primary">{t('sections.gettingStarted.guide.title')}</span>
                    <ChevronDown
                      size={16}
                      className={`text-accent-primary transition-transform ${showGuide ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showGuide && (
                    <div className="mt-2 p-3 bg-gradient-to-r from-accent-primary/5 to-purple-500/5 border border-accent-primary/10 rounded-lg space-y-2">
                      <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
                        <li>{t('sections.gettingStarted.guide.step1')}</li>
                        <li>{t('sections.gettingStarted.guide.step2')}</li>
                        <li>{t('sections.gettingStarted.guide.step3')}</li>
                        <li>{t('sections.gettingStarted.guide.step4')}</li>
                      </ol>
                      <div className="pt-2 border-t border-accent-primary/10 space-y-1">
                        <p className="text-xs text-gray-300">
                          <strong className="text-purple-400">{t('sections.gettingStarted.guide.trayTip')}</strong>
                        </p>
                        <p className="text-xs text-gray-400">
                          • <kbd className="px-1 bg-dark-hover rounded text-[10px]">⌘</kbd> + <kbd className="px-1 bg-dark-hover rounded text-[10px]">Enter</kbd> {t('sections.gettingStarted.guide.cmdEnter')}
                        </p>
                        <p className="text-xs text-gray-400">
                          • <kbd className="px-1 bg-dark-hover rounded text-[10px]">⌘</kbd> + <kbd className="px-1 bg-dark-hover rounded text-[10px]">1-4</kbd> {t('sections.gettingStarted.guide.cmd14')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Language */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Globe size={14} />
                    {t('language.title')}
                  </label>
                  <select
                    value={settings.language || 'auto'}
                    onChange={(e) => handleLanguageChange(e.target.value as 'auto' | 'en' | 'ko')}
                    className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  >
                    {LANGUAGE_VALUES.map((val) => (
                      <option key={val} value={val}>
                        {t(`language.${val}`)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    {t('language.description')}
                  </p>
                </div>

                {/* Shortcut Key */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Keyboard size={14} />
                    {t('shortcut.title')}
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
                        {s.label}{s.descKey ? ` - ${t(`shortcut.${s.descKey}`)}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    {t('shortcut.description')}
                  </p>
                </div>

                {/* Text Capture Mode */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <MousePointer2 size={14} />
                    {t('captureMode.title')}
                  </label>
                  <select
                    value={settings.captureMode}
                    onChange={(e) => updateSetting('captureMode', e.target.value as 'auto' | 'selection' | 'clipboard')}
                    className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  >
                    <option value="auto">{t('captureMode.auto')}</option>
                    <option value="selection">{t('captureMode.selection')}</option>
                    <option value="clipboard">{t('captureMode.clipboard')}</option>
                  </select>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong className="text-gray-400">{t('captureMode.auto').split(' ')[0]}:</strong> {t('captureMode.autoDesc')}</p>
                    <p><strong className="text-gray-400">{t('captureMode.selection').split(' ')[0]}:</strong> {t('captureMode.selectionDesc')}</p>
                    <p><strong className="text-gray-400">{t('captureMode.clipboard').split(' ')[0]}:</strong> {t('captureMode.clipboardDesc')}</p>
                  </div>
                </div>
              </Section>

              {/* ⚙️ Behavior Section */}
              <Section
                title={t('sections.behavior.title')}
                icon="⚙️"
                isOpen={showBehavior}
                onToggle={() => setShowBehavior(!showBehavior)}
              >
                {/* Window Behavior */}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('sections.behavior.window')}</h4>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-gray-400" />
                        <span className="text-sm">{t('sections.behavior.alwaysOnTop')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.behavior.alwaysOnTopDesc')}</span>
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
                        <span className="text-sm">{t('sections.behavior.hideOnCopy')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.behavior.hideOnCopyDesc')}</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.hideOnCopy}
                      onChange={(v) => updateSetting('hideOnCopy', v)}
                    />
                  </div>

                  {/* Settings conflict warning */}
                  {settings.alwaysOnTop && settings.hideOnCopy && (
                    <div className="flex items-start gap-2 p-2 mt-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-yellow-500/90">
                        {t('sections.behavior.conflictWarning')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-gray-400" />
                        <span className="text-sm">{t('sections.behavior.autoShowWindow')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.behavior.autoShowWindowDesc')}</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.autoShowWindow ?? true}
                      onChange={(v) => updateSetting('autoShowWindow', v)}
                    />
                  </div>
                </div>

                {/* Notifications */}
                <div className="pt-3 border-t border-dark-border">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-gray-400" />
                        <span className="text-sm">{t('sections.behavior.showNotifications')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.behavior.showNotificationsDesc')}</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.showNotifications}
                      onChange={(v) => updateSetting('showNotifications', v)}
                    />
                  </div>
                </div>
              </Section>

              {/* ✨ Smart Features Section */}
              <Section
                title={t('sections.smart.title')}
                icon="✨"
                isOpen={showSmartFeatures}
                onToggle={() => setShowSmartFeatures(!showSmartFeatures)}
              >
                {/* Multi-Provider AI Settings */}
                <ProviderSettings />

                {/* Auto Detection */}
                <div className="pt-3 border-t border-dark-border space-y-3">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('sections.smart.autoDetect')}</h4>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Clipboard size={14} className="text-gray-400" />
                        <span className="text-sm">{t('sections.smart.clipboardWatch')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.smart.clipboardWatchDesc')}</span>
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
                          <span className="text-sm">{t('sections.smart.autoAnalyze')}</span>
                        </div>
                        <span className="text-xs text-gray-500">{t('sections.smart.autoAnalyzeDesc')}</span>
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
                        <span className="text-sm">{t('sections.smart.aiContextPopup')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.smart.aiContextPopupDesc')}</span>
                      {settings.enableAIContextPopup && (
                        <div className="mt-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
                          {t('sections.smart.aiContextPopupWarning')}
                        </div>
                      )}
                    </div>
                    <ToggleSwitch
                      checked={settings.enableAIContextPopup ?? false}
                      onChange={(v) => updateSetting('enableAIContextPopup', v)}
                    />
                  </div>
                </div>

                {/* Auto Apply (info) */}
                <div className="pt-3 border-t border-dark-border">
                  <div className="p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-accent-primary" />
                      <h4 className="text-sm font-medium text-accent-primary">{t('sections.smart.autoApply.title')}</h4>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {t('sections.smart.autoApply.description')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('sections.smart.autoApply.note')}
                    </p>
                  </div>
                </div>
              </Section>

              {/* 📁 Projects & Templates Section (Phase 4) */}
              <Section
                title={t('sections.projectTemplates.title')}
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
                    {t('sections.projectTemplates.projectTab')}
                  </button>
                  <button
                    onClick={() => setProjectTemplatesTab('templates')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      projectTemplatesTab === 'templates'
                        ? 'bg-accent-primary text-white'
                        : 'bg-dark-hover text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {t('sections.projectTemplates.templatesTab')}
                  </button>
                </div>

                {/* Tab Content */}
                {projectTemplatesTab === 'project' ? (
                  <ProjectSettings projectPath={currentProjectPath} />
                ) : (
                  <TemplateManager />
                )}
              </Section>

              {/* 🔧 Advanced Section */}
              <Section
                title={t('sections.advanced.title')}
                icon="🔧"
                isOpen={showAdvanced}
                onToggle={() => setShowAdvanced(!showAdvanced)}
              >
                {/* Quick Action Mode */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-gray-400" />
                        <span className="text-sm">{t('sections.advanced.quickAction')}</span>
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded uppercase font-medium">{t('sections.advanced.experimental')}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t('sections.advanced.quickActionDesc')}</span>
                    </div>
                    <ToggleSwitch
                      checked={settings.quickActionMode ?? false}
                      onChange={(v) => updateSetting('quickActionMode', v)}
                    />
                  </div>
                </div>
              </Section>

              {/* ℹ️ App Info */}
              <div className="pt-4 border-t border-dark-border">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>PromptLint v{appVersion || '...'}</p>
                  <p>{tc('copyright', { year: new Date().getFullYear() })}</p>
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
            {tc('close')}
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
