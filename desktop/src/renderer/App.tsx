import { useState, useEffect, useCallback } from 'react';
import { X, Minus, BarChart3, Lightbulb, ArrowLeft, Settings as SettingsIcon, Edit3, Send } from 'lucide-react';
import GoldenRadar from './components/GoldenRadar';
import ProgressTracker from './components/ProgressTracker';
import PersonalTips from './components/PersonalTips';
import IssueList from './components/IssueList';
import PromptComparison, { RewriteResult, VariantType } from './components/PromptComparison';
import ContextIndicator, { SessionContextInfo } from './components/ContextIndicator';
import Settings from './components/Settings';

// Analysis result types
interface Issue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  suggestion: string;
}

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
  issues: Issue[];
  personalTips: string[];
  improvedPrompt?: string; // deprecated, 호환성 유지
  promptVariants: RewriteResult[]; // 신규: 3가지 변형
  sessionContext?: SessionContextInfo; // 세션 컨텍스트
}

type ViewMode = 'analysis' | 'progress' | 'tips';

function App() {
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('analysis');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [inputText, setInputText] = useState('');

  // Listen for clipboard text from main process
  useEffect(() => {
    // Signal to main process that renderer is ready to receive IPC messages
    window.electronAPI.signalReady().then(() => {
      console.log('[Renderer] Signaled ready to main process');
    });

    window.electronAPI.onClipboardText((text) => {
      console.log('[Renderer] Received clipboard text:', text?.substring(0, 50));
      setOriginalPrompt(text);
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
            category: 'analysis',
            message: '분석 엔진 연결 실패',
            suggestion: '앱을 다시 시작해보세요',
          },
        ],
        personalTips: ['분석 모듈 로드 대기 중...'],
        improvedPrompt: undefined,
        promptVariants: [],
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleCopy = async (text: string) => {
    await window.electronAPI.setClipboard(text);
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


  return (
    <div className="window-container h-full flex flex-col text-gray-200">
      {/* Title Bar */}
      <div className="titlebar flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-surface">
        <div className="flex items-center gap-2">
          {viewMode !== 'analysis' && (
            <button
              onClick={() => setViewMode('analysis')}
              className="p-1 rounded-md hover:bg-dark-hover transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <span className="text-sm font-semibold">
            {viewMode === 'analysis' ? 'PromptLint' : viewMode === 'progress' ? '내 진행 상황' : '맞춤 팁'}
          </span>
          {viewMode === 'analysis' && analysis && (
            <span
              className={`grade-badge text-2xl font-bold ${getGradeColor(analysis.grade)}`}
            >
              {analysis.grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded-md hover:bg-dark-hover transition-colors"
            title="설정"
          >
            <SettingsIcon size={14} />
          </button>
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
        {viewMode === 'progress' ? (
          <ProgressTracker />
        ) : viewMode === 'tips' ? (
          <PersonalTips currentTips={analysis?.personalTips} />
        ) : isAnalyzing ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : analysis ? (
          <>
            {/* Session Context Indicator */}
            <ContextIndicator context={analysis.sessionContext} />

            {/* GOLDEN Score Summary with Radar Chart */}
            <div className="bg-dark-surface rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm text-gray-400">GOLDEN Score</span>
                  <div className="text-2xl font-bold">{analysis.overallScore}%</div>
                </div>
                <span
                  className={`grade-badge text-4xl font-bold ${getGradeColor(analysis.grade)}`}
                >
                  {analysis.grade}
                </span>
              </div>
              <div className="flex justify-center">
                <GoldenRadar scores={analysis.goldenScores} size={200} />
              </div>
            </div>

            {/* Issues */}
            <IssueList issues={analysis.issues} />

            {/* Personal Tips Preview */}
            {analysis.personalTips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb size={16} className="text-accent-primary" />
                    <span>맞춤 팁</span>
                  </div>
                  <button
                    onClick={() => setViewMode('tips')}
                    className="text-xs text-accent-primary hover:underline"
                  >
                    더 보기
                  </button>
                </div>
                <div className="bg-dark-surface rounded-lg p-3 space-y-2">
                  {analysis.personalTips.slice(0, 2).map((tip, index) => (
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
          <div className="flex flex-col h-full">
            {/* Shortcut instructions */}
            {!showDirectInput && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <BarChart3 size={48} className="mb-4 opacity-50" />
                <div className="text-center space-y-3">
                  <p className="text-sm font-medium text-gray-300">프롬프트 분석하기</p>
                  <div className="text-xs space-y-1">
                    <p className="text-gray-400">텍스트 선택 후</p>
                    <p>
                      <kbd className="px-2 py-1 bg-dark-surface rounded text-xs">⌘</kbd> +{' '}
                      <kbd className="px-2 py-1 bg-dark-surface rounded text-xs">⇧</kbd> +{' '}
                      <kbd className="px-2 py-1 bg-dark-surface rounded text-xs">P</kbd>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Direct input area */}
            {showDirectInput && (
              <div className="flex-1 flex flex-col space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    // Cmd/Ctrl + Enter to submit
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && inputText.trim()) {
                      e.preventDefault();
                      setOriginalPrompt(inputText);
                      analyzePrompt(inputText);
                      setShowDirectInput(false);
                      setInputText('');
                    }
                  }}
                  placeholder="분석할 프롬프트를 입력하세요... (⌘+Enter로 분석)"
                  className="flex-1 w-full p-3 bg-dark-hover border border-dark-border rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent-primary placeholder-gray-600"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (inputText.trim()) {
                      setOriginalPrompt(inputText);
                      analyzePrompt(inputText);
                      setShowDirectInput(false);
                      setInputText('');
                    }
                  }}
                  disabled={!inputText.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  <Send size={16} />
                  <span>분석하기</span>
                </button>
              </div>
            )}

            {/* Toggle button */}
            <div className="pt-4 border-t border-dark-border mt-4">
              <button
                onClick={() => setShowDirectInput(!showDirectInput)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-lg transition-colors"
              >
                <Edit3 size={14} />
                <span>{showDirectInput ? '단축키로 분석하기' : '직접 입력하기'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {viewMode === 'analysis' && (
        <div className="p-4 border-t border-dark-border bg-dark-surface space-y-4">
          {/* Prompt Comparison (new) */}
          {analysis && analysis.promptVariants.length > 0 && (
            <PromptComparison
              originalPrompt={originalPrompt}
              variants={analysis.promptVariants}
              onCopy={handleCopy}
            />
          )}

          {/* Progress button */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('progress')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-dark-hover hover:bg-dark-border rounded-lg text-sm transition-colors"
            >
              <BarChart3 size={16} />
              <span>내 진행 상황 보기</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
