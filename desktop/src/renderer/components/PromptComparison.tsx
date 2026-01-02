import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, Sparkles, FileText, Wand2 } from 'lucide-react';

export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean; // API 미설정 시 true
}

interface PromptComparisonProps {
  originalPrompt: string;
  variants: RewriteResult[];
  onCopy: (text: string) => void;
  onOpenSettings?: () => void; // Settings 열기 콜백
}

// Shortcut key mapping (support up to 4 variants with AI)
const SHORTCUT_KEYS = ['1', '2', '3', '4'];

const VARIANT_COLORS: Record<VariantType, { bg: string; text: string; border: string }> = {
  ai: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  conservative: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  balanced: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  comprehensive: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
};

export default function PromptComparison({
  originalPrompt,
  variants,
  onCopy,
  onOpenSettings,
}: PromptComparisonProps) {
  // Default to AI variant (index 0) if available, otherwise balanced (index 1)
  const hasAiVariant = variants.length > 0 && variants[0].isAiGenerated;
  const [currentIndex, setCurrentIndex] = useState(hasAiVariant ? 0 : 1);
  const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Copy a specific variant by index
  const copyVariant = useCallback((index: number) => {
    if (index >= 0 && index < variants.length) {
      onCopy(variants[index].rewrittenPrompt);
      setCopiedIndex(index);
      setCurrentIndex(index);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setCopiedIndex(null);
      }, 2000);
    }
  }, [variants, onCopy]);

  // Keyboard shortcuts: ⌘1, ⌘2, ⌘3 to copy variants
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for ⌘ (Mac) or Ctrl (Windows/Linux)
      if (e.metaKey || e.ctrlKey) {
        const keyIndex = SHORTCUT_KEYS.indexOf(e.key);
        if (keyIndex !== -1 && keyIndex < variants.length) {
          e.preventDefault();
          copyVariant(keyIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [variants, copyVariant]);

  if (variants.length === 0) {
    return null;
  }

  const currentVariant = variants[currentIndex];
  const colors = VARIANT_COLORS[currentVariant.variant];

  const handlePrev = () => {
    setCurrentIndex((i) => (i - 1 + variants.length) % variants.length);
    setCopied(false);
  };

  const handleNext = () => {
    setCurrentIndex((i) => (i + 1) % variants.length);
    setCopied(false);
  };

  const handleCopy = () => {
    copyVariant(currentIndex);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent-primary" />
          <span className="text-sm font-medium">프롬프트 개선 비교</span>
        </div>
        <div className="flex items-center gap-1">
          {variants.map((v, i) => (
            <button
              key={v.variant + i}
              onClick={() => {
                if (v.needsSetup) {
                  setCurrentIndex(i);
                } else {
                  copyVariant(i);
                }
              }}
              title={v.needsSetup ? '설정 필요' : `⌘${i + 1}`}
              className={`relative px-2 py-0.5 text-xs rounded transition-all flex items-center gap-1 ${
                copiedIndex === i
                  ? 'bg-accent-success/30 text-accent-success ring-1 ring-accent-success'
                  : i === currentIndex
                  ? `${VARIANT_COLORS[v.variant].bg} ${VARIANT_COLORS[v.variant].text}`
                  : v.needsSetup
                  ? 'bg-dark-hover text-gray-500 hover:text-amber-400/70 border border-dashed border-amber-500/30'
                  : 'bg-dark-hover text-gray-500 hover:text-gray-400'
              }`}
            >
              {v.variant === 'ai' && <Wand2 size={10} />}
              {!v.needsSetup && <span className="opacity-50 mr-0.5 text-[10px]">⌘{i + 1}</span>}
              {v.variantLabel}
              {copiedIndex === i && (
                <span className="absolute -top-1 -right-1 w-3 h-3 flex items-center justify-center bg-accent-success rounded-full">
                  <Check size={8} className="text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison panels */}
      <div className="grid grid-cols-2 gap-2">
        {/* Original */}
        <div className="bg-dark-surface rounded-lg p-3 border border-dark-border">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dark-border">
            <FileText size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500 font-medium">원본</span>
          </div>
          <div className="text-sm text-gray-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {originalPrompt}
          </div>
        </div>

        {/* Improved */}
        <div className={`bg-dark-surface rounded-lg p-3 border ${colors.border}`}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dark-border">
            {currentVariant.isAiGenerated || currentVariant.variant === 'ai' ? (
              <Wand2 size={14} className={colors.text} />
            ) : (
              <Sparkles size={14} className={colors.text} />
            )}
            <span className={`text-xs font-medium ${colors.text}`}>
              개선 ({currentVariant.variantLabel})
            </span>
            {currentVariant.isAiGenerated && (
              <span className="px-1.5 py-0.5 bg-amber-500/30 text-amber-400 text-[10px] rounded font-medium">
                AI
              </span>
            )}
          </div>
          {currentVariant.needsSetup ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Wand2 size={28} className="text-amber-400 mb-3" />
              <p className="text-gray-300 text-sm mb-1">AI 프롬프트 개선 사용하기</p>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Settings에서 Claude API 키를 설정하면<br/>
                AI가 더 정확한 프롬프트 개선을 제안합니다
              </p>
              <button
                onClick={() => onOpenSettings?.()}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
              >
                설정하기
              </button>
            </div>
          ) : (
            <>
              {currentVariant.aiExplanation && (
                <div className="text-xs text-gray-400 mb-2 pb-2 border-b border-dark-border/50 italic">
                  {currentVariant.aiExplanation}
                </div>
              )}
              <div className="text-sm text-gray-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {currentVariant.rewrittenPrompt}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key changes */}
      {!currentVariant.needsSetup && currentVariant.keyChanges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentVariant.keyChanges.map((change, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-dark-hover text-gray-400 text-xs rounded-full"
            >
              {change}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {currentVariant.needsSetup ? (
          <button
            onClick={() => onOpenSettings?.()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          >
            <Wand2 size={16} />
            AI 개선 설정하기
          </button>
        ) : (
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied
                ? 'bg-accent-success/20 text-accent-success'
                : 'bg-accent-primary hover:bg-accent-primary/90 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check size={16} />
                복사됨!
              </>
            ) : (
              <>
                <Copy size={16} />
                개선된 프롬프트 복사
              </>
            )}
          </button>
        )}

        {variants.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-2 bg-dark-surface hover:bg-dark-hover rounded-lg transition-colors"
              title="이전 제안"
            >
              <ChevronLeft size={16} className="text-gray-400" />
            </button>
            <span className="text-xs text-gray-500 min-w-[3rem] text-center">
              {currentIndex + 1}/{variants.length}
            </span>
            <button
              onClick={handleNext}
              className="p-2 bg-dark-surface hover:bg-dark-hover rounded-lg transition-colors"
              title="다음 제안"
            >
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
