import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Keyboard, Eye, Bell, Clipboard, Ghost, Sparkles, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProviderSettings from './ProviderSettings';
import type { ClipboardMode } from '../../main/settings-store';

interface AppSettings {
  shortcut: string;
  alwaysOnTop: boolean;
  showNotifications: boolean;
  clipboardMode: ClipboardMode;
  ghostBar: {
    enabled: boolean;
    showOnlyOnImprovement: boolean;
    minimumConfidence: number;
  };
}

// Available shortcuts (ordered by conflict likelihood: safest first)
const AVAILABLE_SHORTCUTS = [
  { value: 'CommandOrControl+Shift+;', label: '⌘⇧;', descKey: 'recommended' },
  { value: 'Alt+CommandOrControl+P', label: '⌥⌘P', descKey: 'keepP' },
  { value: 'CommandOrControl+Alt+Shift+L', label: 'Hyper+L', descKey: 'noConflict' },
  { value: 'CommandOrControl+Alt+Shift+P', label: 'Hyper+P', descKey: 'noConflict' },
  { value: 'CommandOrControl+Shift+P', label: '⌘⇧P', descKey: 'current' },
  { value: 'CommandOrControl+Shift+L', label: '⌘⇧L', descKey: '' },
  { value: 'CommandOrControl+Shift+K', label: '⌘⇧K', descKey: '' },
];

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'keyboard' | 'clipboard' | 'ai'>('general');

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

  // Load settings on mount
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
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: t('sections.appearance.title'), icon: Eye },
    { id: 'keyboard', label: t('sections.keyboard.title'), icon: Keyboard },
    { id: 'clipboard', label: t('sections.clipboard.title'), icon: Clipboard },
    { id: 'ai', label: t('sections.ai.title'), icon: SettingsIcon },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in shadow-2xl">
      <div className="bg-dark-surface/95 border border-dark-border w-[640px] h-[480px] rounded-2xl overflow-hidden shadow-2xl flex flex-col scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border bg-dark-elevated/30 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-primary/20 rounded-xl">
              <SettingsIcon size={20} className="text-accent-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-100">{t('title')}</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{tc('appDescription')}</p>
            </div>
            {showSavedFeedback && (
              <span className="ml-2 px-2 py-0.5 bg-accent-success/20 text-accent-success text-[10px] font-medium rounded-full animate-fade-in">
                {t('saved')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-transparent hover:bg-dark-hover hover:border-dark-border text-gray-400 Transition-all group"
            aria-label={t('closeAria')}
            title={t('closeHint')}
          >
            <X size={18} className="group-hover:text-gray-200" />
          </button>
        </div>

        {/* Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-48 border-r border-dark-border bg-dark-elevated/10 shrink-0 py-4 flex flex-col">
            <nav className="flex-1 px-3 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all transform active:scale-[0.98] ${activeTab === tab.id
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-[1.02]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
                    }`}
                >
                  <tab.icon size={18} strokeWidth={2.5} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
            <div className="px-6 py-4 border-t border-dark-border mt-auto opacity-40">
              <p className="text-[10px] text-gray-500 font-mono tracking-tighter">v0.1.0-STABLE</p>
            </div>
          </aside>

          {/* Setting Content Area */}
          <main className="flex-1 overflow-y-auto bg-dark-surface/30">
            {!settings ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-primary border-t-transparent" />
                <p className="text-xs font-mono animate-pulse">{t('loading')}</p>
              </div>
            ) : (
              <div className="p-8 space-y-8 animate-fade-in">
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <header>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">{t('sections.appearance.title')}</h3>
                      <p className="text-sm text-gray-500">{t('sections.appearance.description')}</p>
                    </header>
                    <div className="bg-dark-elevated/40 border border-dark-border rounded-2xl divide-y divide-dark-border overflow-hidden">
                      <SettingToggle
                        icon={Eye}
                        label={t('sections.appearance.alwaysOnTop')}
                        description={t('sections.appearance.alwaysOnTopDesc')}
                        checked={settings.alwaysOnTop}
                        onChange={(v) => updateSetting('alwaysOnTop', v)}
                      />
                      <SettingToggle
                        icon={Bell}
                        label={t('sections.appearance.showNotifications')}
                        description={t('sections.appearance.showNotificationsDesc')}
                        checked={settings.showNotifications}
                        onChange={(v) => updateSetting('showNotifications', v)}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'keyboard' && (
                  <div className="space-y-6">
                    <header>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">{t('sections.keyboard.title')}</h3>
                      <p className="text-sm text-gray-500">{t('sections.keyboard.description')}</p>
                    </header>
                    <div className="bg-dark-elevated/40 border border-dark-border rounded-2xl p-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-200">
                              {t('sections.keyboard.globalShortcut')}
                            </label>
                            <p className="text-xs text-gray-500">{t('sections.keyboard.description')}</p>
                          </div>
                          <span className="px-4 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-sm font-bold rounded-xl font-mono shadow-inner">
                            {AVAILABLE_SHORTCUTS.find(s => s.value === settings.shortcut)?.label}
                          </span>
                        </div>
                        <select
                          value={settings.shortcut}
                          onChange={(e) => updateSetting('shortcut', e.target.value)}
                          className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-xl text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all appearance-none cursor-pointer hover:border-gray-500"
                        >
                          {AVAILABLE_SHORTCUTS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}{s.descKey ? ` — ${t(`shortcut.${s.descKey}`)}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'clipboard' && (
                  <div className="space-y-6">
                    <header>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">{t('sections.clipboard.title')}</h3>
                      <p className="text-sm text-gray-500">{t('sections.clipboard.description') || 'Configure how analysis results are integrated with your clipboard.'}</p>
                    </header>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {(['disabled', 'manual', 'auto-visible', 'auto-hide'] as ClipboardMode[]).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => updateSetting('clipboardMode', mode)}
                            className={`p-4 rounded-2xl border text-left transition-all ${settings.clipboardMode === mode
                              ? 'bg-accent-primary/10 border-accent-primary border-2'
                              : 'bg-dark-elevated/40 border-dark-border hover:border-gray-600'
                              }`}
                          >
                            <p className={`text-sm font-bold mb-1 ${settings.clipboardMode === mode ? 'text-accent-primary' : 'text-gray-200'}`}>
                              {t(`sections.clipboard.${mode}`)}
                            </p>
                            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                              {t(`sections.clipboard.${mode}Desc`)}
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="bg-dark-elevated/40 border border-dark-border rounded-2xl p-2 mt-4">
                        <SettingToggle
                          icon={Ghost}
                          label={t('sections.clipboard.ghostBar')}
                          description={t('sections.clipboard.ghostBarDesc')}
                          checked={settings.ghostBar?.enabled ?? false}
                          onChange={(v) => updateSetting('ghostBar', { ...settings.ghostBar, enabled: v })}
                        />
                        {settings.ghostBar?.enabled && (
                          <div className="mx-4 mb-4 p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-xl text-xs text-gray-400 flex items-center gap-3">
                            <Sparkles size={16} className="text-accent-primary shrink-0" />
                            <p className="leading-tight">{t('sections.clipboard.ghostBarNote')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="space-y-6 max-h-full overflow-visible">
                    <header>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">{t('sections.ai.title')}</h3>
                      <p className="text-sm text-gray-500">{t('sections.ai.description') || 'Choose your AI provider for prompt analysis and improvements.'}</p>
                    </header>
                    <div className="bg-dark-elevated/40 border border-dark-border rounded-2xl p-6">
                      <ProviderSettings />
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-dark-border bg-dark-elevated/20 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-gray-500 font-medium">
            {t('sections.keyboard.description')}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 hover:bg-white text-dark-surface rounded-xl text-xs font-bold transition-all transform active:scale-[0.98] shadow-lg"
          >
            {tc('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Setting Toggle Component
function SettingToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-dark-hover/20 transition-colors group">
      <div className="flex items-center gap-4 flex-1">
        <div className={`p-2 rounded-lg transition-all ${checked ? 'bg-accent-primary/20 text-accent-primary shadow-[0_0_15px_-5px_var(--accent-primary)]' : 'bg-dark-border/40 text-gray-500'}`}>
          <Icon size={18} strokeWidth={checked ? 2.5 : 2} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
            {label}
          </span>
          <span className="text-xs text-gray-500 leading-normal max-w-[280px]">
            {description}
          </span>
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

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
      className={`relative w-12 h-6 rounded-full transition-all duration-300 transform active:scale-95 flex-shrink-0 ${checked
        ? 'bg-accent-primary ring-4 ring-accent-primary/10 shadow-[0_0_15px_-3px_var(--accent-primary)]'
        : 'bg-dark-border border border-dark-border'
        }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-lg transition-transform duration-300 ease-out flex items-center justify-center ${checked ? 'translate-x-6' : 'translate-x-0'
          }`}
      >
        {checked && <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />}
      </span>
    </button>
  );
}
