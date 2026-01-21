import { useEffect, useCallback, useReducer, useMemo, memo } from 'react';
import { Copy, Check, Sparkles, FileText, Wand2, Play, AlertCircle, ChevronDown, ChevronUp, GitCompare, Loader2, Zap } from 'lucide-react';
import { diffWords } from 'diff';

// DiffView component for word-level diff highlighting
interface DiffViewProps {
  original: string;
  improved: string;
  className?: string;
}

function DiffView({ original, improved, className = '' }: DiffViewProps) {
  const parts = useMemo(() => diffWords(original, improved), [original, improved]);

  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="bg-green-500/30 text-green-300 rounded px-0.5">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={i} className="bg-red-500/30 text-red-400 line-through opacity-60 rounded px-0.5">
              {part.value}
            </span>
          );
        }
        return <span key={i} className="text-gray-300">{part.value}</span>;
      })}
    </div>
  );
}

// State management with useReducer for better performance
interface ComparisonState {
  selectedIndex: number;
  showOriginal: boolean; // true = show original, false = show variant
  viewMode: 'single' | 'diff';
  copied: boolean;
  copiedIndex: number | null;
  applying: boolean;
  applyResult: { success: boolean; message?: string } | null;
  isExpanded: boolean;
}

type ComparisonAction =
  | { type: 'SELECT_VARIANT'; index: number }
  | { type: 'SHOW_ORIGINAL' }
  | { type: 'SET_VIEW_MODE'; mode: 'single' | 'diff' }
  | { type: 'COPY_SUCCESS'; index: number }
  | { type: 'COPY_RESET' }
  | { type: 'APPLY_START' }
  | { type: 'APPLY_COMPLETE'; result: { success: boolean; message?: string } }
  | { type: 'APPLY_RESET' }
  | { type: 'TOGGLE_EXPAND' };

function comparisonReducer(state: ComparisonState, action: ComparisonAction): ComparisonState {
  switch (action.type) {
    case 'SELECT_VARIANT':
      return { ...state, selectedIndex: action.index, showOriginal: false, copied: false, copiedIndex: null };
    case 'SHOW_ORIGINAL':
      return { ...state, showOriginal: true, copied: false, copiedIndex: null };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'COPY_SUCCESS':
      return { ...state, copied: true, copiedIndex: action.index, selectedIndex: action.index, showOriginal: false };
    case 'COPY_RESET':
      return { ...state, copied: false, copiedIndex: null };
    case 'APPLY_START':
      return { ...state, applying: true, applyResult: null };
    case 'APPLY_COMPLETE':
      return { ...state, applying: false, applyResult: action.result };
    case 'APPLY_RESET':
      return { ...state, applyResult: null };
    case 'TOGGLE_EXPAND':
      return { ...state, isExpanded: !state.isExpanded };
    default:
      return state;
  }
}

export type VariantType = 'conservative' | 'balanced' | 'comprehensive' | 'ai' | 'cosp';

export type ProviderType = 'claude' | 'openai' | 'gemini';

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean; // API 미설정 시 true
  isLoading?: boolean; // Phase 3.1: 비동기 AI 로딩 중
  // Multi-provider metadata
  provider?: ProviderType; // 사용된 프로바이더
  wasFallback?: boolean;   // Fallback 발생 여부
  fallbackReason?: string; // Fallback 사유
}

// Provider display names for UI
const PROVIDER_NAMES: Record<ProviderType, string> = {
  claude: 'Claude',
  openai: 'GPT',
  gemini: 'Gemini',
};

interface PromptComparisonProps {
  originalPrompt: string;
  variants: RewriteResult[];
  onCopy: (text: string) => void;
  onApply?: (text: string) => Promise<{ success: boolean; message?: string }>; // 적용 콜백
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
  cosp: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  // Legacy variant types (kept for backwards compatibility)
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

function PromptComparisonInner({
  originalPrompt,
  variants,
  onCopy,
  onApply,
  onOpenSettings,
}: PromptComparisonProps) {
  // Check for AI variant (loaded, not loading)
  const hasAiVariant = variants.length > 0 && variants[0].isAiGenerated && !variants[0].isLoading;

  // Find best variant by confidence for auto-selection
  const bestVariantIndex = useMemo(() => {
    if (variants.length === 0) return 0;
    return variants.reduce((best, v, i) => {
      // Skip needsSetup and isLoading variants
      if (v.needsSetup || v.isLoading) return best;
      return v.confidence > (variants[best]?.confidence ?? 0) ? i : best;
    }, hasAiVariant ? 0 : 1);
  }, [variants, hasAiVariant]);

  // Initialize state with useReducer
  const [state, dispatch] = useReducer(comparisonReducer, {
    selectedIndex: bestVariantIndex,
    showOriginal: false,
    viewMode: 'single',
    copied: false,
    copiedIndex: null,
    applying: false,
    applyResult: null,
    isExpanded: false,
  });

  const { selectedIndex, showOriginal, viewMode, copied, copiedIndex, applying, applyResult, isExpanded } = state;

  // Auto-select best variant when variants change
  useEffect(() => {
    dispatch({ type: 'SELECT_VARIANT', index: bestVariantIndex });
  }, [bestVariantIndex]);

  // 텍스트 길이에 따라 자동 확장 여부 결정 (200자 이상이면 축소 가능)
  const shouldShowExpandToggle = useMemo(() =>
    originalPrompt.length > 200 ||
    (variants[selectedIndex] && variants[selectedIndex].rewrittenPrompt.length > 200),
    [originalPrompt.length, variants, selectedIndex]
  );

  // Copy a specific variant by index - stable callback
  const copyVariant = useCallback((index: number) => {
    if (index >= 0 && index < variants.length && !variants[index].needsSetup) {
      console.log('[PromptComparison] Copying variant, calling onCopy...');
      onCopy(variants[index].rewrittenPrompt);
      dispatch({ type: 'COPY_SUCCESS', index });
      setTimeout(() => dispatch({ type: 'COPY_RESET' }), 2000);
    }
  }, [variants, onCopy]);

  // Apply variant to source app - stable callback
  const applyVariant = useCallback(async (index?: number) => {
    if (!onApply) return;

    const targetIndex = index ?? selectedIndex;
    if (targetIndex < 0 || targetIndex >= variants.length) return;
    if (variants[targetIndex].needsSetup) return;

    dispatch({ type: 'APPLY_START' });

    try {
      const result = await onApply(variants[targetIndex].rewrittenPrompt);
      dispatch({ type: 'APPLY_COMPLETE', result });
      setTimeout(() => dispatch({ type: 'APPLY_RESET' }), 3000);
    } catch {
      dispatch({ type: 'APPLY_COMPLETE', result: { success: false, message: '적용 실패' } });
    }
  }, [selectedIndex, variants, onApply]);

  // Keyboard shortcuts - stable handler with empty deps using refs pattern
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      // ⌘+Enter: Apply current variant
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey && hasAiVariant) {
          applyVariant(0);
        } else {
          applyVariant();
        }
        return;
      }

      // ⌘1-4: Copy specific variant
      const keyIndex = SHORTCUT_KEYS.indexOf(e.key);
      if (keyIndex !== -1 && keyIndex < variants.length) {
        e.preventDefault();
        copyVariant(keyIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [variants.length, hasAiVariant, copyVariant, applyVariant]);

  if (variants.length === 0) {
    return null;
  }

  const currentVariant = variants[selectedIndex];
  const colors = VARIANT_COLORS[currentVariant.variant];

  const handleCopy = () => {
    copyVariant(selectedIndex);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-accent-primary" />
        <span className="text-sm font-medium">프롬프트 개선 비교</span>
      </div>

      {/* Horizontal Tab Bar */}
      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1"
        role="tablist"
        aria-label="프롬프트 변형 선택"
      >
        {/* Original Tab */}
        <button
          onClick={() => dispatch({ type: 'SHOW_ORIGINAL' })}
          role="tab"
          aria-selected={showOriginal}
          aria-controls="prompt-content-panel"
          className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 ${
            showOriginal
              ? 'bg-gray-600/30 text-gray-200 ring-1 ring-gray-500/50'
              : 'bg-dark-hover text-gray-500 hover:text-gray-300'
          }`}
        >
          <FileText size={12} />
          원본
        </button>

        {/* Variant Tabs */}
        {variants.map((v, i) => (
          <button
            key={v.variant + i}
            onClick={() => {
              dispatch({ type: 'SELECT_VARIANT', index: i });
            }}
            role="tab"
            aria-selected={!showOriginal && i === selectedIndex}
            aria-controls="prompt-content-panel"
            aria-label={`${v.variantLabel} 변형 (${v.isLoading ? '분석 중' : v.needsSetup ? '설정 필요' : `⌘${i + 1}`})`}
            title={v.isLoading ? 'AI 분석 중...' : v.needsSetup ? '설정 필요' : `⌘${i + 1}`}
            className={`relative flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 ${
              copiedIndex === i
                ? 'bg-accent-success/30 text-accent-success ring-1 ring-accent-success'
                : !showOriginal && i === selectedIndex
                ? `${VARIANT_COLORS[v.variant].bg} ${VARIANT_COLORS[v.variant].text} ring-1 ${VARIANT_COLORS[v.variant].border}`
                : v.isLoading
                ? 'bg-amber-500/10 text-amber-400/70 border border-dashed border-amber-500/30 animate-pulse'
                : v.needsSetup
                ? 'bg-dark-hover text-gray-500 hover:text-amber-400/70 border border-dashed border-amber-500/30'
                : 'bg-dark-hover text-gray-500 hover:text-gray-300'
            }`}
          >
            {v.variant === 'ai' && (
              v.isLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />
            )}
            {v.variant === 'cosp' && <Zap size={12} />}
            {!v.needsSetup && !v.isLoading && <span className="opacity-50 text-[10px]">⌘{i + 1}</span>}
            {v.variantLabel}
            {v.isLoading && <span className="text-[10px] opacity-70">분석중</span>}
            {copiedIndex === i && (
              <span className="absolute -top-1 -right-1 w-3 h-3 flex items-center justify-center bg-accent-success rounded-full">
                <Check size={8} className="text-white" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Single Content Panel */}
      <div
        id="prompt-content-panel"
        role="tabpanel"
        aria-label={showOriginal ? '원본 프롬프트' : '개선된 프롬프트'}
        className={`bg-dark-surface rounded-lg p-3 border ${
          showOriginal ? 'border-dark-border' : colors.border
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dark-border">
          {showOriginal ? (
            <>
              <FileText size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">원본 프롬프트</span>
              <span className="text-[10px] text-gray-600 ml-auto">{originalPrompt.length}자</span>
            </>
          ) : (
            <>
              {currentVariant.isLoading ? (
                <Loader2 size={14} className="text-amber-400 animate-spin" />
              ) : currentVariant.isAiGenerated || currentVariant.variant === 'ai' ? (
                <Wand2 size={14} className={colors.text} />
              ) : currentVariant.variant === 'cosp' ? (
                <Zap size={14} className={colors.text} />
              ) : (
                <Sparkles size={14} className={colors.text} />
              )}
              <span className={`text-xs font-medium ${colors.text}`}>
                {currentVariant.variantLabel}
                {currentVariant.isLoading && <span className="text-gray-500 ml-1">(분석중...)</span>}
              </span>
              {currentVariant.isAiGenerated && !currentVariant.isLoading && (
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-amber-500/30 text-amber-400 text-[10px] rounded font-medium">
                    {currentVariant.provider ? PROVIDER_NAMES[currentVariant.provider] : 'AI'}
                  </span>
                  {currentVariant.wasFallback && (
                    <span className="px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[9px] rounded" title={currentVariant.fallbackReason}>
                      fallback
                    </span>
                  )}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {/* View Mode Toggle */}
                {!currentVariant.needsSetup && !currentVariant.isLoading && (
                  <button
                    onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: viewMode === 'single' ? 'diff' : 'single' })}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      viewMode === 'diff'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-dark-hover text-gray-500 hover:text-gray-300'
                    }`}
                    title={viewMode === 'diff' ? '개선된 텍스트만 보기' : '원본과 비교하기'}
                  >
                    <GitCompare size={12} />
                    {viewMode === 'diff' ? '차이' : '비교'}
                  </button>
                )}
                {!currentVariant.needsSetup && !currentVariant.isLoading && (
                  <span className="text-[10px] text-gray-600">{currentVariant.rewrittenPrompt.length}자</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Panel Content */}
        {showOriginal ? (
          <div
            className={`text-sm text-gray-400 whitespace-pre-wrap break-words overflow-y-auto transition-all duration-200 ${
              isExpanded ? 'max-h-[400px]' : 'max-h-40'
            }`}
          >
            {originalPrompt}
          </div>
        ) : currentVariant.isLoading ? (
          // Phase 3.1: Loading state for async AI variant
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 size={32} className="text-amber-400 mb-3 animate-spin" />
            <p className="text-gray-300 text-sm mb-1">AI가 프롬프트를 분석하고 있습니다</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              잠시만 기다려주세요...<br/>
              다른 탭을 먼저 확인할 수 있습니다
            </p>
          </div>
        ) : currentVariant.needsSetup ? (
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
            {viewMode === 'diff' ? (
              <DiffView
                original={originalPrompt}
                improved={currentVariant.rewrittenPrompt}
                className={`text-sm whitespace-pre-wrap break-words overflow-y-auto transition-all duration-200 ${
                  isExpanded ? 'max-h-[400px]' : 'max-h-40'
                }`}
              />
            ) : (
              <div
                className={`text-sm text-gray-200 whitespace-pre-wrap break-words overflow-y-auto transition-all duration-200 ${
                  isExpanded ? 'max-h-[400px]' : 'max-h-40'
                }`}
              >
                {currentVariant.rewrittenPrompt}
              </div>
            )}
          </>
        )}
      </div>

      {/* Expand/Collapse Toggle */}
      {shouldShowExpandToggle && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_EXPAND' })}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-dark-hover rounded transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              접기
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              전체 보기
            </>
          )}
        </button>
      )}

      {/* Key changes - only show for loaded variants */}
      {!showOriginal && !currentVariant.needsSetup && !currentVariant.isLoading && currentVariant.keyChanges.length > 0 && (
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

      {/* Apply Result Message */}
      {applyResult && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            applyResult.success
              ? 'bg-accent-success/20 text-accent-success'
              : 'bg-amber-500/20 text-amber-400'
          }`}
        >
          {applyResult.success ? (
            <Check size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{applyResult.message || (applyResult.success ? '적용됨!' : '적용 실패')}</span>
        </div>
      )}

      {/* Actions - only show for loaded variants */}
      {!showOriginal && !currentVariant.isLoading && (
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
            <>
              {/* Apply Button or Blocked Notice */}
              {!onApply && (
                <div
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-500 bg-dark-hover/50 cursor-not-allowed"
                  title="이 앱에서는 자동 적용이 지원되지 않습니다. 복사 후 수동으로 붙여넣어주세요."
                >
                  <Play size={16} className="opacity-50" />
                  <span className="opacity-70">적용 불가</span>
                </div>
              )}
              {onApply && (
                <button
                  onClick={() => applyVariant()}
                  disabled={applying}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    applying
                      ? 'bg-accent-primary/50 text-white/70 cursor-wait'
                      : 'bg-accent-primary hover:bg-accent-primary/90 text-white'
                  }`}
                  title="⌘+Enter"
                >
                  {applying ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      적용 중...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      적용
                    </>
                  )}
                </button>
              )}

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-accent-success/20 text-accent-success'
                    : 'bg-dark-hover hover:bg-dark-border text-gray-300'
                }`}
                title="복사"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    복사됨!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    복사
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Shortcut Guide - only show for variants */}
      {!showOriginal && !currentVariant.needsSetup && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-dark-border/50 text-[10px] text-gray-500">
          {onApply && (
            <span>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded">⌘</kbd>
              <kbd className="px-1 py-0.5 bg-dark-hover rounded ml-0.5">Enter</kbd>
              <span className="ml-1">적용</span>
            </span>
          )}
          <span>
            <kbd className="px-1 py-0.5 bg-dark-hover rounded">⌘</kbd>
            <kbd className="px-1 py-0.5 bg-dark-hover rounded ml-0.5">1-4</kbd>
            <span className="ml-1">복사</span>
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-dark-hover rounded">Esc</kbd>
            <span className="ml-1">닫기</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Memoized export to prevent unnecessary re-renders
const PromptComparison = memo(PromptComparisonInner, (prev, next) => {
  return (
    prev.originalPrompt === next.originalPrompt &&
    prev.variants === next.variants &&
    prev.onApply === next.onApply &&
    prev.onCopy === next.onCopy &&
    prev.onOpenSettings === next.onOpenSettings
  );
});

export default PromptComparison;
