import { useState, useEffect, useCallback } from 'react';
import { X, Minus, Copy, BarChart3, AlertTriangle, Lightbulb } from 'lucide-react';

// Placeholder types - will be replaced with actual analysis types
interface AnalysisResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
  }>;
  personalTips: string[];
  improvedPrompt?: string;
}

function App() {
  const [promptText, setPromptText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Listen for clipboard text from main process
  useEffect(() => {
    window.electronAPI.onClipboardText((text) => {
      setPromptText(text);
      analyzePrompt(text);
    });

    return () => {
      window.electronAPI.removeClipboardListener();
    };
  }, []);

  const analyzePrompt = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsAnalyzing(true);
    try {
      // Call the analysis engine via IPC
      const result = await window.electronAPI.analyzePrompt(text);
      setAnalysis(result as AnalysisResult);
    } catch (error) {
      console.error('Analysis failed:', error);
      // Fallback to basic analysis if IPC fails
      setAnalysis({
        overallScore: 50,
        grade: 'C',
        goldenScores: {
          goal: 50,
          output: 50,
          limits: 50,
          data: 50,
          evaluation: 50,
          next: 50,
        },
        issues: [
          {
            severity: 'medium',
            message: '분석 엔진 연결 실패',
            suggestion: '앱을 다시 시작해보세요',
          },
        ],
        personalTips: ['분석 모듈 로드 대기 중...'],
        improvedPrompt: undefined,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleCopyImproved = async () => {
    if (analysis?.improvedPrompt) {
      await window.electronAPI.setClipboard(analysis.improvedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-accent-success';
      case 'B':
        return 'text-blue-400';
      case 'C':
        return 'text-accent-warning';
      default:
        return 'text-accent-error';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 text-red-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="window-container h-full flex flex-col text-gray-200">
      {/* Title Bar */}
      <div className="titlebar flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-surface">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">PromptLint</span>
          {analysis && (
            <span
              className={`grade-badge text-2xl font-bold ${getGradeColor(analysis.grade)}`}
            >
              {analysis.grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="p-1.5 rounded-md hover:bg-dark-hover transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isAnalyzing ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : analysis ? (
          <>
            {/* GOLDEN Score Summary */}
            <div className="bg-dark-surface rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">GOLDEN Score</span>
                <span className="text-lg font-semibold">{analysis.overallScore}%</span>
              </div>
              <div className="grid grid-cols-6 gap-2 text-center text-xs">
                {Object.entries(analysis.goldenScores).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-gray-500 uppercase">{key[0]}</div>
                    <div
                      className={`font-medium ${
                        value >= 70
                          ? 'text-accent-success'
                          : value >= 50
                          ? 'text-accent-warning'
                          : 'text-accent-error'
                      }`}
                    >
                      {value}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues */}
            {analysis.issues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle size={16} className="text-accent-warning" />
                  <span>발견된 문제 ({analysis.issues.length})</span>
                </div>
                {analysis.issues.map((issue, index) => (
                  <div
                    key={index}
                    className="issue-item bg-dark-surface rounded-lg p-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(
                          issue.severity
                        )}`}
                      >
                        {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '중간' : '낮음'}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm">{issue.message}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          → {issue.suggestion}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Personal Tips */}
            {analysis.personalTips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb size={16} className="text-accent-primary" />
                  <span>맞춤 팁</span>
                </div>
                <div className="bg-dark-surface rounded-lg p-3 space-y-2">
                  {analysis.personalTips.map((tip, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-accent-secondary">•</span>
                      <span className="text-gray-300">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <BarChart3 size={48} className="mb-4 opacity-50" />
            <p className="text-sm">텍스트를 선택하고</p>
            <p className="text-sm">
              <kbd className="px-2 py-1 bg-dark-surface rounded text-xs">⌘</kbd> +{' '}
              <kbd className="px-2 py-1 bg-dark-surface rounded text-xs">⇧</kbd> +{' '}
              <kbd className="px-2 py-1 bg-dark-surface rounded text-xs">P</kbd>
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {analysis && (
        <div className="p-4 border-t border-dark-border bg-dark-surface">
          <div className="flex gap-2">
            <button
              onClick={handleCopyImproved}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium transition-colors"
            >
              <Copy size={16} />
              {copied ? '복사됨!' : '개선된 프롬프트 복사'}
            </button>
            <button className="px-4 py-2 bg-dark-hover hover:bg-dark-border rounded-lg text-sm transition-colors">
              <BarChart3 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
