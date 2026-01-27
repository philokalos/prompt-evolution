import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Keyboard, Eye, Bell, Clipboard, Ghost, ChevronDown, type LucideIcon } from 'lucide-react';
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

  // Section collapse states
  const [showAppearance, setShowAppearance] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showClipboard, setShowClipboard] = useState(false);
  const [showAI, setShowAI] = useState(false);

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
              {/* 1. Appearance & Behavior */}
              <Section
                title={t('sections.appearance.title')}
                icon={Eye}
                isOpen={showAppearance}
                onToggle={() => setShowAppearance(!showAppearance)}
              >
                <div className="space-y-3">
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
              </Section>

              {/* 2. Keyboard Shortcuts */}
              <Section
                title={t('sections.keyboard.title')}
                icon={Keyboard}
                isOpen={showKeyboard}
                onToggle={() => setShowKeyboard(!showKeyboard)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">
                      {t('sections.keyboard.globalShortcut')}
                    </label>
                    <span className="px-2 py-0.5 bg-accent-primary/20 text-accent-primary text-xs rounded font-mono">
                      {AVAILABLE_SHORTCUTS.find(s => s.value === settings.shortcut)?.label}
                    </span>
                  </div>
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
                    {t('sections.keyboard.description')}
                  </p>
                </div>
              </Section>

              {/* 3. Clipboard Integration */}
              <Section
                title={t('sections.clipboard.title')}
                icon={Clipboard}
                isOpen={showClipboard}
                onToggle={() => setShowClipboard(!showClipboard)}
              >
                <div className="space-y-4">
                  {/* Clipboard Mode Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">
                      {t('sections.clipboard.mode')}
                    </label>
                    <select
                      value={settings.clipboardMode}
                      onChange={(e) => updateSetting('clipboardMode', e.target.value as ClipboardMode)}
                      className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    >
                      <option value="disabled">{t('sections.clipboard.disabled')}</option>
                      <option value="manual">{t('sections.clipboard.manual')}</option>
                      <option value="auto-visible">{t('sections.clipboard.autoVisible')}</option>
                      <option value="auto-hide">{t('sections.clipboard.autoHide')}</option>
                    </select>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p><strong className="text-gray-400">{t('sections.clipboard.disabled')}:</strong> {t('sections.clipboard.disabledDesc')}</p>
                      <p><strong className="text-gray-400">{t('sections.clipboard.manual')}:</strong> {t('sections.clipboard.manualDesc')}</p>
                      <p><strong className="text-gray-400">{t('sections.clipboard.autoVisible')}:</strong> {t('sections.clipboard.autoVisibleDesc')}</p>
                      <p><strong className="text-gray-400">{t('sections.clipboard.autoHide')}:</strong> {t('sections.clipboard.autoHideDesc')}</p>
                    </div>
                  </div>

                  {/* Ghost Bar Toggle */}
                  <div className="pt-3 border-t border-dark-border">
                    <SettingToggle
                      icon={Ghost}
                      label={t('sections.clipboard.ghostBar')}
                      description={t('sections.clipboard.ghostBarDesc')}
                      checked={settings.ghostBar?.enabled ?? false}
                      onChange={(v) => updateSetting('ghostBar', { ...settings.ghostBar, enabled: v })}
                    />
                    {settings.ghostBar?.enabled && (
                      <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-gray-400">
                        {t('sections.clipboard.ghostBarNote')}
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* 4. AI Provider */}
              <Section
                title={t('sections.ai.title')}
                icon={SettingsIcon}
                isOpen={showAI}
                onToggle={() => setShowAI(!showAI)}
              >
                <ProviderSettings />
              </Section>
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
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: LucideIcon;
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
          <Icon size={14} className="text-accent-primary" />
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
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gray-400" />
          <span className="text-sm">{label}</span>
        </div>
        <span className="text-xs text-gray-500">{description}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
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
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
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
