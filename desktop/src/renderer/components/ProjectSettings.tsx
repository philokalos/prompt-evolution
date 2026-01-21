/**
 * Project Settings Component
 * Phase 4: Project-specific configuration management
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, FolderOpen, AlertCircle, Check, X } from 'lucide-react';
import type { ProjectSettings } from '../electron.d';

interface ProjectSettingsProps {
  projectPath?: string;
  onClose?: () => void;
}

// Variant option keys (values are translation keys)
const VARIANT_KEYS = ['conservative', 'balanced', 'comprehensive', 'ai'] as const;

export default function ProjectSettings({ projectPath, onClose }: ProjectSettingsProps) {
  const { t } = useTranslation('settings');
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [ideType, setIdeType] = useState('');
  const [preferredVariant, setPreferredVariant] = useState<'conservative' | 'balanced' | 'comprehensive' | 'ai'>('balanced');
  const [customConstraints, setCustomConstraints] = useState('');
  const [autoInjectContext, setAutoInjectContext] = useState(true);

  useEffect(() => {
    if (!projectPath) return;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await window.electronAPI.getProjectSettings(projectPath);

        if (data) {
          setSettings(data);
          setProjectName(data.projectName || '');
          setIdeType(data.ideType || '');
          setPreferredVariant(data.preferredVariant || 'balanced');
          setCustomConstraints(data.customConstraints || '');
          setAutoInjectContext(data.autoInjectContext !== false);
        }
      } catch (err) {
        console.error('Failed to load project settings:', err);
        setError(t('project.loadError'));
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [projectPath, t]);

  const handleSave = async () => {
    if (!projectPath) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const newSettings: ProjectSettings = {
        projectPath,
        projectName: projectName.trim() || undefined,
        ideType: ideType.trim() || undefined,
        preferredVariant,
        customConstraints: customConstraints.trim() || undefined,
        autoInjectContext,
      };

      await window.electronAPI.saveProjectSettings(newSettings);
      setSettings(newSettings);
      setSaveSuccess(true);

      // Auto-hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save project settings:', err);
      setError(t('project.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!projectPath || !confirm(t('project.resetConfirm'))) return;

    try {
      await window.electronAPI.deleteProjectSettings(projectPath);

      // Reset form to defaults
      setProjectName('');
      setIdeType('');
      setPreferredVariant('balanced');
      setCustomConstraints('');
      setAutoInjectContext(true);
      setSettings(null);

      alert(t('project.resetSuccess'));
    } catch (err) {
      console.error('Failed to delete project settings:', err);
      setError(t('project.resetError'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-dark-hover rounded w-1/3"></div>
          <div className="h-20 bg-dark-hover rounded"></div>
          <div className="h-4 bg-dark-hover rounded w-1/4"></div>
          <div className="h-10 bg-dark-hover rounded"></div>
        </div>
      </div>
    );
  }

  if (!projectPath) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
        <p>{t('project.noProject')}</p>
        <p className="text-sm mt-2">{t('project.noProjectHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-accent-primary" />
          <h3 className="text-lg font-medium">{t('project.title')}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark-hover rounded transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Project Path Display */}
      <div className="bg-dark-surface rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">{t('project.projectPath')}</div>
        <div className="text-sm text-gray-300 font-mono break-all">{projectPath}</div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          <Check size={16} />
          <span>{t('project.saved')}</span>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('project.projectName')} <span className="text-gray-500">{t('project.projectNameOptional')}</span>
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={t('project.projectNamePlaceholder')}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
          />
        </div>

        {/* IDE Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('project.ideType')} <span className="text-gray-500">{t('project.ideTypeOptional')}</span>
          </label>
          <input
            type="text"
            value={ideType}
            onChange={(e) => setIdeType(e.target.value)}
            placeholder={t('project.ideTypePlaceholder')}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('project.ideTypeHint')}
          </p>
        </div>

        {/* Preferred Variant */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('project.improvementStyle')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {VARIANT_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setPreferredVariant(key)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  preferredVariant === key
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-gray-700/30 hover:border-gray-600 bg-dark-surface'
                }`}
              >
                <div className="font-medium text-sm mb-1">{t(`project.variant.${key}`)}</div>
                <div className="text-xs text-gray-400">{t(`project.variant.${key}Desc`)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Constraints */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('project.customConstraints')} <span className="text-gray-500">{t('project.customConstraintsOptional')}</span>
          </label>
          <textarea
            value={customConstraints}
            onChange={(e) => setCustomConstraints(e.target.value)}
            placeholder={t('project.customConstraintsPlaceholder')}
            rows={4}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('project.customConstraintsHint')}
          </p>
        </div>

        {/* Auto-inject Context */}
        <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
          <input
            type="checkbox"
            id="auto-inject"
            checked={autoInjectContext}
            onChange={(e) => setAutoInjectContext(e.target.checked)}
            className="mt-1"
          />
          <label htmlFor="auto-inject" className="flex-1 cursor-pointer">
            <div className="text-sm font-medium mb-1">{t('project.autoInjectContext')}</div>
            <div className="text-xs text-gray-400">
              {t('project.autoInjectContextDesc')}
            </div>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700/30">
        <button
          onClick={handleReset}
          disabled={!settings}
          className="px-4 py-2 text-sm text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('project.resetSettings')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>{t('project.saving')}</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{t('project.save')}</span>
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 rounded-lg p-4 border border-accent-primary/20">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-accent-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-300 space-y-1">
            {(t('project.infoTips', { returnObjects: true }) as string[]).map((tip, index) => (
              <p key={index}>• {tip}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
