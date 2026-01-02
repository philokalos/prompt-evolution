import { useState, useEffect, useCallback } from 'react';
import { Check, X, ArrowRight, Loader2 } from 'lucide-react';

interface QuickActionProps {
  originalGrade: string;
  improvedGrade: string;
  improvedText: string;
  onApply: () => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
  autoHideSeconds?: number; // 0 = no auto-hide
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-accent-success',
  B: 'text-blue-400',
  C: 'text-accent-warning',
  D: 'text-orange-400',
  F: 'text-accent-error',
};

/**
 * QuickAction - Minimal floating panel for one-click prompt application
 *
 * Shows: [Original Grade] → [Improved Grade] [✓ Apply] [✕ Cancel]
 */
export default function QuickAction({
  originalGrade,
  improvedGrade,
  improvedText: _improvedText,
  onApply,
  onCancel,
  autoHideSeconds = 0,
}: QuickActionProps) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [countdown, setCountdown] = useState(autoHideSeconds);

  // Auto-hide countdown
  useEffect(() => {
    if (autoHideSeconds <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoHideSeconds, onCancel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleApply = useCallback(async () => {
    if (applying) return;

    setApplying(true);
    try {
      const result = await onApply();
      setResult(result);

      if (result.success) {
        // Auto-close after success
        setTimeout(onCancel, 500);
      }
    } catch (error) {
      setResult({ success: false, message: '적용 실패' });
    } finally {
      setApplying(false);
    }
  }, [applying, onApply, onCancel]);

  const originalColor = GRADE_COLORS[originalGrade] || 'text-gray-400';
  const improvedColor = GRADE_COLORS[improvedGrade] || 'text-gray-400';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-dark-surface border border-dark-border rounded-xl shadow-xl">
      {/* Grade Change */}
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${originalColor}`}>{originalGrade}</span>
        <ArrowRight size={16} className="text-gray-500" />
        <span className={`text-lg font-bold ${improvedColor}`}>{improvedGrade}</span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-dark-border" />

      {/* Result Message */}
      {result && !result.success && (
        <span className="text-sm text-amber-400">{result.message}</span>
      )}

      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={applying}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          applying
            ? 'bg-accent-primary/50 text-white/70 cursor-wait'
            : 'bg-accent-primary hover:bg-accent-primary/90 text-white'
        }`}
        title="Enter"
      >
        {applying ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} />
        )}
        적용
      </button>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-hover hover:bg-dark-border rounded-lg text-sm text-gray-400 transition-colors"
        title="Esc"
      >
        <X size={14} />
        {countdown > 0 && <span className="text-xs opacity-60">({countdown})</span>}
      </button>
    </div>
  );
}
