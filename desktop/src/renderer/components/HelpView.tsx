import { useState, useEffect, useMemo } from 'react';
import {
  Keyboard,
  MonitorSmartphone,
  Clipboard,
  Sparkles,
  MousePointer2,
  Zap,
  Code2,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Command,
  ExternalLink,
  Target,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_COMPATIBILITY, shortcutToKeys, formatShortcut } from '../../shared/constants';

// GOLDEN dimension keys for rendering
const GOLDEN_KEYS = ['goal', 'output', 'limits', 'data', 'evaluation', 'next'] as const;
const GOLDEN_LABELS = ['G', 'O', 'L', 'D', 'E', 'N'] as const;

interface HelpSectionData {
  id: string;
  icon: React.ReactNode;
  badge?: 'essential' | 'optional' | 'advanced';
  hasShortcuts?: boolean;
}

// Section metadata (icons, badges) - translations come from help.json
const SECTION_DATA: HelpSectionData[] = [
  { id: 'hotkey', icon: <Keyboard size={20} />, badge: 'essential', hasShortcuts: true },
  { id: 'tray', icon: <MonitorSmartphone size={20} />, badge: 'essential' },
  { id: 'clipboard', icon: <Clipboard size={20} />, badge: 'optional' },
  { id: 'aibutton', icon: <Sparkles size={20} />, badge: 'optional' },
  { id: 'capture', icon: <MousePointer2 size={20} />, badge: 'advanced' },
  { id: 'variants', icon: <Zap size={20} />, badge: 'essential', hasShortcuts: true },
  { id: 'ide', icon: <Code2 size={20} />, badge: 'advanced' },
  { id: 'progress', icon: <TrendingUp size={20} />, badge: 'essential' },
];

function HelpView() {
  const { t } = useTranslation('help');
  const [expandedSection, setExpandedSection] = useState<string | null>('hotkey');
  const [currentShortcut, setCurrentShortcut] = useState<string>('CommandOrControl+Shift+P');

  // Load current shortcut from settings
  useEffect(() => {
    window.electronAPI?.getSettings?.().then((settings) => {
      if (settings?.shortcut) {
        setCurrentShortcut(settings.shortcut as string);
      }
    }).catch(console.error);
  }, []);

  const shortcutKeys = useMemo(() => shortcutToKeys(currentShortcut), [currentShortcut]);
  const shortcutDisplay = useMemo(() => formatShortcut(currentShortcut), [currentShortcut]);

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const getBadgeStyle = (badge?: string) => {
    switch (badge) {
      case 'essential':
        return 'bg-accent-primary/20 text-accent-primary';
      case 'optional':
        return 'bg-accent-secondary/20 text-accent-secondary';
      case 'advanced':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Get howToUse items from translation, replacing {{shortcut}} placeholder
  const getHowToUse = (sectionId: string): string[] => {
    const items = t(`sections.${sectionId}.howToUse`, { returnObjects: true, shortcut: shortcutDisplay }) as string[];
    return Array.isArray(items) ? items : [];
  };

  // Get tips items from translation
  const getTips = (sectionId: string): string[] => {
    const items = t(`sections.${sectionId}.tips`, { returnObjects: true }) as string[];
    return Array.isArray(items) ? items : [];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center pb-2 border-b border-dark-border">
        <h2 className="text-lg font-semibold text-gray-200">{t('headerTitle')}</h2>
        <p className="text-xs text-gray-500 mt-1">
          {t('headerDesc')}
        </p>
      </div>

      {/* Feature List */}
      <div className="space-y-2">
        {SECTION_DATA.map((section) => {
          const howToUse = getHowToUse(section.id);
          const tips = getTips(section.id);

          return (
            <div
              key={section.id}
              className="bg-dark-surface rounded-lg overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-dark-hover transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-dark-hover rounded-lg flex items-center justify-center text-accent-primary">
                  {section.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">
                      {t(`sections.${section.id}.title`)}
                    </span>
                    {section.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${getBadgeStyle(section.badge)}`}
                      >
                        {t(`badges.${section.badge}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t(`sections.${section.id}.description`)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-gray-500">
                  {expandedSection === section.id ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </div>
              </button>

              {/* Section Details */}
              {expandedSection === section.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-dark-border">
                  {/* How to Use */}
                  <div className="pt-3">
                    <h4 className="text-xs font-medium text-gray-400 mb-2">
                      {t('hotkey.title') === t(`sections.${section.id}.title`) ? t('sections.hotkey.shortcuts.analyze') : ''}
                    </h4>
                    <ol className="space-y-1.5">
                      {howToUse.map((step, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-xs text-gray-300"
                        >
                          {step.startsWith('•') ? (
                            <span className="text-accent-secondary ml-3">{step}</span>
                          ) : (
                            <>
                              <span className="flex-shrink-0 w-4 h-4 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-[10px]">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tips */}
                  {tips.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
                      <h4 className="text-xs font-medium text-amber-400 mb-1.5">
                        💡 Tips
                      </h4>
                      <ul className="space-y-1">
                        {tips.map((tip, index) => (
                          <li
                            key={index}
                            className="text-xs text-amber-300/80 flex items-start gap-1.5"
                          >
                            <span className="text-amber-500">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Shortcuts - for hotkey and variants sections */}
                  {section.hasShortcuts && section.id === 'hotkey' && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2">
                        {t('hotkey.title')}
                      </h4>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            {shortcutKeys.map((key, keyIndex) => (
                              <kbd key={keyIndex} className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">
                                {key}
                              </kbd>
                            ))}
                          </div>
                          <span className="text-gray-500">{t('sections.hotkey.shortcuts.analyze')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">Esc</kbd>
                          <span className="text-gray-500">{t('sections.hotkey.shortcuts.close')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {section.hasShortcuts && section.id === 'variants' && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 mb-2">
                        {t('hotkey.title')}
                      </h4>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">⌘</kbd>
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">Enter</kbd>
                          </div>
                          <span className="text-gray-500">{t('sections.variants.shortcuts.apply')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">⌘</kbd>
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">1</kbd>
                          </div>
                          <span className="text-gray-500">{t('sections.variants.shortcuts.copy1')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">⌘</kbd>
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">2</kbd>
                          </div>
                          <span className="text-gray-500">{t('sections.variants.shortcuts.copy2')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">⌘</kbd>
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">3</kbd>
                          </div>
                          <span className="text-gray-500">{t('sections.variants.shortcuts.copy3')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">⌘</kbd>
                            <kbd className="px-1.5 py-0.5 bg-dark-hover border border-dark-border rounded text-[10px] text-gray-300">4</kbd>
                          </div>
                          <span className="text-gray-500">{t('sections.variants.shortcuts.copy4')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Reference */}
      <div className="bg-dark-surface rounded-lg p-3 space-y-2">
        <h3 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Command size={12} />
          {t('quickRef.title')}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              {shortcutKeys.map((key, idx) => (
                <kbd key={idx} className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">{key}</kbd>
              ))}
            </div>
            <span>{t('quickRef.analyze')}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">↵</kbd>
            </div>
            <span>{t('quickRef.apply')}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">Esc</kbd>
            </div>
            <span>{t('quickRef.close')}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-0.5">
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded text-[10px]">1-4</kbd>
            </div>
            <span>{t('quickRef.copy')}</span>
          </div>
        </div>
      </div>

      {/* GOLDEN Checklist Explanation */}
      <div className="bg-dark-surface rounded-lg p-3 space-y-3">
        <h3 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Target size={12} />
          {t('goldenExplain.title')}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {t('goldenExplain.description')}
        </p>
        <div className="space-y-2">
          {GOLDEN_KEYS.map((key, index) => (
            <div key={key} className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-[10px] font-bold">
                {GOLDEN_LABELS[index]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-300">
                  <span className="font-medium">{t(`golden.${key}.title`)}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{t(`golden.${key}.short`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* App Compatibility */}
      <div className="bg-dark-surface rounded-lg p-3 space-y-3">
        <h3 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <MonitorSmartphone size={12} />
          {t('appCompat.title')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            <span className="text-xs text-gray-300">{t('appCompat.fullSupport')}</span>
            <span className="text-[10px] text-gray-500">
              {APP_COMPATIBILITY.filter(a => a.mode === 'full').map(a => a.name).join(', ')}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-gray-300">{t('appCompat.clipboardOnly')}</span>
              <span className="text-[10px] text-gray-500 ml-1">
                {t('appCompat.clipboardNote')}
              </span>
              <p className="text-[10px] text-gray-500">
                {APP_COMPATIBILITY.filter(a => a.mode === 'clipboard').map(a => a.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          {t('appCompat.explanation')}
        </p>
      </div>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-dark-border">
        <button
          onClick={() => {
            window.electronAPI?.openExternal?.('https://github.com/philokalos/prompt-evolution');
          }}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-accent-primary transition-colors"
        >
          <span>{t('footer.viewDocs')}</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}

export default HelpView;
