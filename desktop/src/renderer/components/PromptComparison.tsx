import { useState } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, Sparkles, FileText } from 'lucide-react';

export type VariantType = 'conservative' | 'balanced' | 'comprehensive';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
}

interface PromptComparisonProps {
  originalPrompt: string;
  variants: RewriteResult[];
  onCopy: (text: string) => void;
}

const VARIANT_COLORS: Record<VariantType, { bg: string; text: string; border: string }> = {
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
}: PromptComparisonProps) {
  const [currentIndex, setCurrentIndex] = useState(1); // 기본: 균형 (index 1)
  const [copied, setCopied] = useState(false);

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
    onCopy(currentVariant.rewrittenPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              key={v.variant}
              onClick={() => {
                setCurrentIndex(i);
                setCopied(false);
              }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                i === currentIndex
                  ? `${VARIANT_COLORS[v.variant].bg} ${VARIANT_COLORS[v.variant].text}`
                  : 'bg-dark-hover text-gray-500 hover:text-gray-400'
              }`}
            >
              {v.variantLabel}
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
            <Sparkles size={14} className={colors.text} />
            <span className={`text-xs font-medium ${colors.text}`}>
              개선 ({currentVariant.variantLabel})
            </span>
          </div>
          <div className="text-sm text-gray-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {currentVariant.rewrittenPrompt}
          </div>
        </div>
      </div>

      {/* Key changes */}
      {currentVariant.keyChanges.length > 0 && (
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
