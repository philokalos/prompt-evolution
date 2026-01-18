/**
 * Project Settings Component
 * Phase 4: Project-specific configuration management
 */

import { useState, useEffect } from 'react';
import { Settings, Save, FolderOpen, AlertCircle, Check, X } from 'lucide-react';
import type { ProjectSettings } from '../electron.d';

interface ProjectSettingsProps {
  projectPath?: string;
  onClose?: () => void;
}

const VARIANT_OPTIONS = [
  {
    value: 'conservative',
    label: '보수적',
    description: '핵심 개선만 제안 (안전)',
  },
  {
    value: 'balanced',
    label: '균형적',
    description: '실용적인 개선 (추천)',
  },
  {
    value: 'comprehensive',
    label: '포괄적',
    description: '모든 개선 제안',
  },
  {
    value: 'ai',
    label: 'AI 최적화',
    description: 'LLM 기반 개선 (느림)',
  },
] as const;

export default function ProjectSettings({ projectPath, onClose }: ProjectSettingsProps) {
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
        setError('설정을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [projectPath]);

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
      setError('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!projectPath || !confirm('프로젝트 설정을 초기화하시겠습니까?')) return;

    try {
      await window.electronAPI.deleteProjectSettings(projectPath);

      // Reset form to defaults
      setProjectName('');
      setIdeType('');
      setPreferredVariant('balanced');
      setCustomConstraints('');
      setAutoInjectContext(true);
      setSettings(null);

      alert('프로젝트 설정이 초기화되었습니다.');
    } catch (err) {
      console.error('Failed to delete project settings:', err);
      setError('설정 초기화에 실패했습니다.');
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
        <p>프로젝트 경로가 설정되지 않았습니다</p>
        <p className="text-sm mt-2">IDE 플러그인에서 프로젝트를 열어주세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-accent-primary" />
          <h3 className="text-lg font-medium">프로젝트 설정</h3>
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
        <div className="text-xs text-gray-500 mb-1">프로젝트 경로</div>
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
          <span>설정이 저장되었습니다</span>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium mb-2">
            프로젝트 이름 <span className="text-gray-500">(선택)</span>
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="예: PromptLint Desktop"
            className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
          />
        </div>

        {/* IDE Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            IDE 타입 <span className="text-gray-500">(선택)</span>
          </label>
          <input
            type="text"
            value={ideType}
            onChange={(e) => setIdeType(e.target.value)}
            placeholder="예: vscode, cursor, webstorm"
            className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            템플릿 추천 시 IDE별 맞춤 제안에 사용됩니다
          </p>
        </div>

        {/* Preferred Variant */}
        <div>
          <label className="block text-sm font-medium mb-2">
            개선 스타일
          </label>
          <div className="grid grid-cols-2 gap-2">
            {VARIANT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPreferredVariant(option.value)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  preferredVariant === option.value
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-gray-700/30 hover:border-gray-600 bg-dark-surface'
                }`}
              >
                <div className="font-medium text-sm mb-1">{option.label}</div>
                <div className="text-xs text-gray-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Constraints */}
        <div>
          <label className="block text-sm font-medium mb-2">
            커스텀 제약조건 <span className="text-gray-500">(선택)</span>
          </label>
          <textarea
            value={customConstraints}
            onChange={(e) => setCustomConstraints(e.target.value)}
            placeholder="프로젝트별 특수 제약사항을 입력하세요&#10;예:&#10;- 한글 주석 사용 금지&#10;- 외부 라이브러리 사용 최소화&#10;- 특정 디자인 패턴 준수"
            rows={4}
            className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            프롬프트 개선 시 이 제약조건을 고려합니다
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
            <div className="text-sm font-medium mb-1">자동 컨텍스트 주입</div>
            <div className="text-xs text-gray-400">
              프롬프트 분석 시 프로젝트 정보를 자동으로 포함합니다
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
          설정 초기화
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>저장</span>
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 rounded-lg p-4 border border-accent-primary/20">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-accent-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-300 space-y-1">
            <p>• 프로젝트별로 다른 개선 스타일을 설정할 수 있습니다</p>
            <p>• IDE 타입 설정 시 최적화된 템플릿을 추천받을 수 있습니다</p>
            <p>• 커스텀 제약조건은 프롬프트 개선 시 반영됩니다</p>
          </div>
        </div>
      </div>
    </div>
  );
}
