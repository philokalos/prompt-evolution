import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, ArrowUpRight, Clipboard } from 'lucide-react';

interface Variant {
  rewrittenPrompt: string;
  variant: string;
  confidence: number;
  keyChanges?: string[];
  variantLabel?: string;
  isAiGenerated?: boolean;
  isLoading?: boolean;
  needsSetup?: boolean;
}

interface ImprovedPromptViewProps {
  variants: Variant[];
  grade: string;
  isSourceAppBlocked?: boolean;
  sourceAppName?: string;
  onApply?: (text: string) => void;
  onCopy?: (text: string) => void;
  onCopyAndSwitch?: (text: string) => void;
  contextIncluded?: boolean;
}

export default function ImprovedPromptView({
  variants,
  grade,
  isSourceAppBlocked,
  onApply,
  onCopy,
  onCopyAndSwitch,
  contextIncluded,
}: ImprovedPromptViewProps) {
  const { t } = useTranslation('analysis');
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  // Find the best usable variant (highest confidence, non-loading, non-setup)
  const bestVariant = variants
    .filter((v) => v.rewrittenPrompt && !v.isLoading && !v.needsSetup)
    .sort((a, b) => b.confidence - a.confidence)[0];

  const handleCopy = useCallback(() => {
    if (!bestVariant) return;
    onCopy?.(bestVariant.rewrittenPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bestVariant, onCopy]);

  const handleApply = useCallback(() => {
    if (!bestVariant) return;
    onApply?.(bestVariant.rewrittenPrompt);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }, [bestVariant, onApply]);

  const handleCopyAndSwitch = useCallback(() => {
    if (!bestVariant) return;
    onCopyAndSwitch?.(bestVariant.rewrittenPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bestVariant, onCopyAndSwitch]);

  if (!bestVariant) {
    if (grade === 'A') {
      return (
        <div className="bg-accent-success/10 border border-accent-success/30 rounded-lg p-3 text-center">
          <p className="text-sm text-accent-success font-medium">{t('improvedPrompt.noImprovement')}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-dark-surface rounded-lg border border-accent-primary/30 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-dark-border">
        <span className="text-xs font-medium text-accent-primary">
          {t('improvedPrompt.title')}
        </span>
        {contextIncluded && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
            {t('improvedPrompt.contextBadge')}
          </span>
        )}
      </div>

      {/* Prompt text */}
      <div className="px-3 py-2.5">
        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed max-h-[120px] overflow-y-auto">
          {bestVariant.rewrittenPrompt}
        </p>
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-3 flex gap-2">
        {isSourceAppBlocked ? (
          <button
            onClick={handleCopyAndSwitch}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-md transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} />
                <span>{t('improvedPrompt.copied')}</span>
              </>
            ) : (
              <>
                <Clipboard size={14} />
                <span>{t('improvedPrompt.copyAndSwitch')}</span>
              </>
            )}
          </button>
        ) : onApply ? (
          <button
            onClick={handleApply}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-md transition-colors"
          >
            {applied ? (
              <>
                <Check size={14} />
                <span>{t('improvedPrompt.copied')}</span>
              </>
            ) : (
              <>
                <ArrowUpRight size={14} />
                <span>{t('improvedPrompt.replace')}</span>
              </>
            )}
          </button>
        ) : null}

        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-dark-hover hover:bg-dark-border text-gray-300 text-sm rounded-md transition-colors"
          title="Copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
