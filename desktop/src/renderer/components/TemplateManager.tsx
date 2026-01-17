/**
 * Template Manager Component
 * Phase 4: CRUD interface for prompt templates
 */

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Edit2, Trash2, Copy, Check, Eye, EyeOff, Search, Filter } from 'lucide-react';
import type { PromptTemplate } from '../electron.d';

interface TemplateManagerProps {
  className?: string;
}

interface TemplateFormData {
  name: string;
  ideType: string;
  category: string;
  templateText: string;
  description: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: '',
  ideType: '',
  category: '',
  templateText: '',
  description: '',
};

export default function TemplateManager({ className = '' }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIde, setFilterIde] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  // Load templates function - extracted to be called from multiple places
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getTemplates({});
      setTemplates(data as PromptTemplate[]);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    let filtered = [...templates];

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.templateText.toLowerCase().includes(query)
      );
    }

    // IDE filter
    if (filterIde) {
      filtered = filtered.filter((t) => t.ideType === filterIde);
    }

    // Category filter
    if (filterCategory) {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    // Active/Inactive filter
    if (!showInactive) {
      filtered = filtered.filter((t) => t.isActive !== false);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, filterIde, filterCategory, showInactive]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      ideType: template.ideType || '',
      category: template.category || '',
      templateText: template.templateText,
      description: template.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.templateText.trim()) {
      alert('템플릿 이름과 내용은 필수입니다');
      return;
    }

    setSaving(true);
    try {
      const template: PromptTemplate = {
        id: editingTemplate?.id,
        name: formData.name.trim(),
        ideType: formData.ideType.trim() || undefined,
        category: formData.category.trim() || undefined,
        templateText: formData.templateText.trim(),
        description: formData.description.trim() || undefined,
        isActive: editingTemplate?.isActive ?? true,
        usageCount: editingTemplate?.usageCount ?? 0,
      };

      await window.electronAPI.saveTemplate(template);
      await loadTemplates();
      setShowModal(false);
      setFormData(EMPTY_FORM);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('템플릿 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: PromptTemplate) => {
    if (!template.id) return;

    if (!confirm(`"${template.name}" 템플릿을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await window.electronAPI.deleteTemplate(template.id);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('템플릿 삭제에 실패했습니다');
    }
  };

  const handleToggleActive = async (template: PromptTemplate) => {
    if (!template.id) return;

    try {
      const updatedTemplate: PromptTemplate = {
        ...template,
        isActive: !template.isActive,
      };
      await window.electronAPI.saveTemplate(updatedTemplate);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to toggle template:', error);
      alert('템플릿 상태 변경에 실패했습니다');
    }
  };

  const handleCopy = async (template: PromptTemplate) => {
    try {
      await window.electronAPI.setClipboard(template.templateText);
      setCopied(template.id || null);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy template:', error);
    }
  };

  // Get unique IDE types and categories for filters
  const ideTypes = Array.from(new Set(templates.map((t) => t.ideType).filter(Boolean)));
  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean)));

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-dark-hover rounded"></div>
          <div className="h-24 bg-dark-hover rounded"></div>
          <div className="h-24 bg-dark-hover rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-accent-primary" />
          <h3 className="text-lg font-medium">템플릿 관리</h3>
          <span className="text-sm text-gray-500">({templates.length}개)</span>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-3 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          <span>새 템플릿</span>
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="템플릿 검색..."
            className="w-full pl-10 pr-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors text-sm"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">필터:</span>
          </div>

          {/* IDE Type Filter */}
          <select
            value={filterIde}
            onChange={(e) => setFilterIde(e.target.value)}
            className="px-2 py-1 bg-dark-surface border border-gray-700/30 rounded text-xs focus:outline-none focus:border-accent-primary"
          >
            <option value="">모든 IDE</option>
            {ideTypes.map((ide) => (
              <option key={ide} value={ide}>
                {ide}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1 bg-dark-surface border border-gray-700/30 rounded text-xs focus:outline-none focus:border-accent-primary"
          >
            <option value="">모든 카테고리</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Show Inactive Toggle */}
          <label className="flex items-center gap-1.5 px-2 py-1 bg-dark-surface border border-gray-700/30 rounded text-xs cursor-pointer hover:border-gray-600 transition-colors">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-3 h-3"
            />
            <span>비활성 표시</span>
          </label>

          {/* Clear Filters */}
          {(searchQuery || filterIde || filterCategory || showInactive) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterIde('');
                setFilterCategory('');
                setShowInactive(false);
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Template List */}
      <div className="space-y-2">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>표시할 템플릿이 없습니다</p>
            <p className="text-sm mt-2">새 템플릿을 추가하거나 필터를 조정해보세요</p>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`p-4 bg-dark-surface border rounded-lg transition-all ${
                template.isActive === false
                  ? 'border-gray-700/30 opacity-60'
                  : 'border-gray-700/30 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    {template.isActive === false && (
                      <span className="px-2 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded">
                        비활성
                      </span>
                    )}
                  </div>

                  {template.description && (
                    <p className="text-xs text-gray-400 mb-2">{template.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {template.ideType && <span>IDE: {template.ideType}</span>}
                    {template.category && <span>카테고리: {template.category}</span>}
                    <span>사용: {template.usageCount || 0}회</span>
                  </div>

                  {/* Template Preview */}
                  <div className="mt-2 p-2 bg-dark-bg rounded text-xs text-gray-400 font-mono overflow-hidden">
                    <div className="line-clamp-2">{template.templateText}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => handleCopy(template)}
                    className="p-2 hover:bg-dark-hover rounded transition-colors"
                    title="복사"
                  >
                    {copied === template.id ? (
                      <Check size={16} className="text-green-400" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleActive(template)}
                    className="p-2 hover:bg-dark-hover rounded transition-colors"
                    title={template.isActive === false ? '활성화' : '비활성화'}
                  >
                    {template.isActive === false ? (
                      <EyeOff size={16} className="text-gray-500" />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 hover:bg-dark-hover rounded transition-colors"
                    title="수정"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 hover:bg-dark-hover rounded transition-colors text-red-400"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div
            className="bg-dark-bg rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-4">
              {editingTemplate ? '템플릿 수정' : '새 템플릿'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  템플릿 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: VS Code 컴포넌트 생성"
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* IDE Type */}
              <div>
                <label className="block text-sm font-medium mb-2">IDE 타입 (선택)</label>
                <input
                  type="text"
                  value={formData.ideType}
                  onChange={(e) => setFormData({ ...formData, ideType: e.target.value })}
                  placeholder="예: vscode, cursor, webstorm"
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-2">카테고리 (선택)</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="예: bug-fix, feature, refactor"
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">설명 (선택)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="템플릿 설명"
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* Template Text */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  템플릿 내용 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.templateText}
                  onChange={(e) => setFormData({ ...formData, templateText: e.target.value })}
                  placeholder="프롬프트 템플릿을 입력하세요..."
                  rows={8}
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-700/30 rounded-lg focus:outline-none focus:border-accent-primary transition-colors resize-none font-mono text-sm"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-700/30">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData(EMPTY_FORM);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !formData.templateText.trim()}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중...' : editingTemplate ? '수정' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
