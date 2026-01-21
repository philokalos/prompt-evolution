/**
 * Template Selector Component
 * Phase 4: Quick template selection for prompt writing
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Star, Copy, Check, X } from 'lucide-react';
import type { PromptTemplate, TemplateContext } from '../electron.d';

interface TemplateSelectorProps {
  context: TemplateContext;
  onSelect: (template: PromptTemplate) => void;
  onClose: () => void;
}

export default function TemplateSelector({ context, onSelect, onClose }: TemplateSelectorProps) {
  const { t } = useTranslation('settings');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [recommended, setRecommended] = useState<PromptTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        // Get recommended template
        const rec = await window.electronAPI.getRecommendedTemplate(context);
        setRecommended(rec);

        // Get all relevant templates
        const allTemplates = await window.electronAPI.getTemplates({
          ideType: context.ideType,
          category: context.category,
          activeOnly: true,
        });

        setTemplates(allTemplates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, [context]);

  const handleSelect = async (template: PromptTemplate) => {
    setSelectedId(template.id || null);

    // Increment usage count
    if (template.id) {
      try {
        await window.electronAPI.incrementTemplateUsage(template.id);
      } catch (error) {
        console.error('Failed to increment template usage:', error);
      }
    }

    onSelect(template);
  };

  const handleCopy = async (template: PromptTemplate) => {
    try {
      await window.electronAPI.setClipboard(template.templateText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy template:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-bg rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-dark-bg rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-accent-primary" />
            <h2 className="text-lg font-medium">{t('templateSelector.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark-hover rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Context Info */}
        <div className="mb-4 p-3 bg-dark-surface rounded-lg text-sm">
          <div className="flex items-center gap-4 text-gray-400">
            {context.ideType && (
              <span>
                {t('templateSelector.ide')} <span className="text-gray-200">{context.ideType}</span>
              </span>
            )}
            {context.category && (
              <span>
                {t('templateSelector.category')} <span className="text-gray-200">{context.category}</span>
              </span>
            )}
          </div>
        </div>

        {/* Recommended Template */}
        {recommended && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-accent-primary">
              <Star size={16} className="fill-current" />
              <span>{t('templateSelector.recommended')}</span>
            </div>
            <div
              className={`p-4 bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 border rounded-lg cursor-pointer transition-all ${
                selectedId === recommended.id
                  ? 'border-accent-primary'
                  : 'border-accent-primary/30 hover:border-accent-primary/50'
              }`}
              onClick={() => handleSelect(recommended)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">{recommended.name}</div>
                  {recommended.description && (
                    <div className="text-xs text-gray-400 mt-1">
                      {recommended.description}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(recommended);
                  }}
                  className="p-1 hover:bg-dark-hover rounded transition-colors"
                >
                  {copied ? (
                    <Check size={16} className="text-green-400" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
              <div className="text-xs text-gray-400">
                {t('templateSelector.usageCount', { count: recommended.usageCount || 0 })}
              </div>
            </div>
          </div>
        )}

        {/* Other Templates */}
        {templates.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2 text-gray-400">
              {t('templateSelector.otherTemplates', { count: templates.length })}
            </div>
            <div className="space-y-2">
              {templates.map((template) => {
                // Skip if it's the recommended one
                if (recommended && template.id === recommended.id) return null;

                return (
                  <div
                    key={template.id}
                    className={`p-3 bg-dark-surface border rounded-lg cursor-pointer transition-all ${
                      selectedId === template.id
                        ? 'border-accent-primary'
                        : 'border-gray-700/30 hover:border-gray-600'
                    }`}
                    onClick={() => handleSelect(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-gray-400 mt-1">
                            {template.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {template.ideType && <span>{t('templateSelector.ide')} {template.ideType}</span>}
                          {template.category && <span>{t('templateSelector.category')} {template.category}</span>}
                          <span>{t('templateSelector.usageCount', { count: template.usageCount || 0 })}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(template);
                        }}
                        className="p-1 hover:bg-dark-hover rounded transition-colors ml-2"
                      >
                        {copied ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {templates.length === 0 && !recommended && (
          <div className="text-center py-8 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t('templateSelector.noTemplates')}</p>
            <p className="text-sm mt-2">{t('templateSelector.noTemplatesHint')}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-700/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {t('templateSelector.cancel')}
          </button>
          <div className="text-xs text-gray-500">
            {t('templateSelector.selectHint')}
          </div>
        </div>
      </div>
    </div>
  );
}
