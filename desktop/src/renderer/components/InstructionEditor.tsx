/**
 * InstructionEditor Component
 *
 * Textarea editor for CLAUDE.md draft with save functionality.
 * Used after generating a CLAUDE.md draft from project analysis.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, FileText, Code2 } from 'lucide-react';

interface DetectedStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  testFrameworks: string[];
}

interface InstructionEditorProps {
  draft: string;
  detectedStack: DetectedStack;
  confidence: number;
  projectPath: string;
  onSave: (filePath: string, content: string) => Promise<{ success: boolean; message?: string }>;
  onSaved?: () => void;
}

export default function InstructionEditor({
  draft,
  detectedStack,
  confidence,
  projectPath,
  onSave,
  onSaved,
}: InstructionEditorProps) {
  const { t } = useTranslation('analysis');
  const [content, setContent] = useState(draft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message?: string } | null>(null);

  const filePath = `${projectPath}/CLAUDE.md`;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const result = await onSave(filePath, content);
      setSaveResult(result);
      if (result.success) {
        onSaved?.();
      }
    } catch {
      setSaveResult({ success: false, message: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  }, [filePath, content, onSave, onSaved]);

  const allStackItems = [
    ...detectedStack.languages,
    ...detectedStack.frameworks,
    ...detectedStack.buildTools,
    ...detectedStack.testFrameworks,
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-indigo-400" />
          <h2 className="text-base font-semibold text-white">
            {t('instructionLinter.generator.title')}
          </h2>
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      {/* Detected Stack */}
      {allStackItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Code2 size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500">
            {t('instructionLinter.generator.detectedStack')}:
          </span>
          {allStackItems.map((item) => (
            <span
              key={item}
              className="text-xs bg-dark-hover text-gray-300 px-2 py-0.5 rounded-full"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-64 bg-dark-hover border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:border-indigo-500"
        spellCheck={false}
      />

      {/* Save button + result */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 truncate max-w-[60%]">
          {filePath}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || content.trim().length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
        >
          <Save size={14} />
          {isSaving ? '...' : t('instructionLinter.generator.save')}
        </button>
      </div>

      {saveResult && (
        <p className={`text-xs ${saveResult.success ? 'text-green-400' : 'text-red-400'}`}>
          {saveResult.success ? 'Saved successfully!' : saveResult.message ?? 'Save failed'}
        </p>
      )}
    </div>
  );
}
