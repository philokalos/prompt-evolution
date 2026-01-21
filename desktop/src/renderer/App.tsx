import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Minus, BarChart3, Lightbulb, ArrowLeft, Settings as SettingsIcon, Edit3, Send, Plus, HelpCircle, ArrowRight, Play, Copy, Check, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';
import GoldenRadar from './components/GoldenRadar';
import ProgressTracker from './components/ProgressTracker';
import PersonalTips from './components/PersonalTips';
import HelpView from './components/HelpView';
import IssueList from './components/IssueList';
import PromptComparison, { RewriteResult } from './components/PromptComparison';
import ContextIndicator, { SessionContextInfo } from './components/ContextIndicator';
import HistoryRecommendations from './components/HistoryRecommendations';
import Settings from './components/Settings';
import type { DetectedProject, HistoryRecommendation, EmptyStatePayload, AIVariantResult } from './electron.d';

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
  // Phase 2: History-based recommendations
  historyRecommendations?: HistoryRecommendation[];
  comparisonWithHistory?: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
}

type ViewMode = 'analysis' | 'progress' | 'tips' | 'help';

/**
 * Convert DetectedProject to minimal SessionContextInfo for display
 */
function projectToContextInfo(project: DetectedProject): SessionContextInfo {
  return {
    projectPath: project.projectPath,
    projectId: project.projectPath.replace(/\//g, '-'),
    sessionId: '',
    currentTask: '',
    techStack: [],
    recentTools: [],
    recentFiles: [],
    lastActivity: new Date(),
    source: 'active-window',
    ideName: project.ideName,
    currentFile: project.currentFile,
    confidence: project.confidence,
    isManual: project.isManual,
  };
}

function App() {
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('analysis');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [currentProject, setCurrentProject] = useState<DetectedProject | null>(null);
  const [shortcutError, setShortcutError] = useState<{ shortcut: string; message: string } | null>(null);
  const [isSourceAppBlocked, setIsSourceAppBlocked] = useState(false); // True if source app doesn't support Apply
  const [emptyState, setEmptyState] = useState<EmptyStatePayload | null>(null); // Empty state when no text captured
  const [quickActionMode, setQuickActionMode] = useState(false);
  const [quickActionCopied, setQuickActionCopied] = useState(false);
  const [quickActionApplying, setQuickActionApplying] = useState(false);
  const [quickActionResult, setQuickActionResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false); // 세부 분석 접이식 상태

  // Project selection handlers
  const handleProjectSelect = useCallback(async (projectPath: string | null) => {
    try {
      await window.electronAPI.selectProject(projectPath);
      // Refresh current project state
      const project = await window.electronAPI.getCurrentProject();
      setCurrentProject(project as DetectedProject | null);
    } catch (error) {
      console.error('Failed to select project:', error);
    }
  }, []);

  const loadAllProjects = useCallback(async (): Promise<DetectedProject[]> => {
    try {
      const projects = await window.electronAPI.getAllOpenProjects();
      return projects as DetectedProject[];
    } catch (error) {
      console.error('Failed to load projects:', error);
      return [];
    }
  }, []);

  // Listen for clipboard text from main process
  useEffect(() => {
    // Signal to main process that renderer is ready to receive IPC messages
    window.electronAPI.signalReady().then(() => {
      console.log('[Renderer] Signaled ready to main process');
    });

    // Get initial project state
    window.electronAPI.getCurrentProject().then((project) => {
      setCurrentProject(project as DetectedProject | null);
    });

    // Load quick action settings and adjust window size accordingly
    window.electronAPI.getSettings().then((settings) => {
      const isQuickMode = (settings.quickActionMode as boolean) ?? false;
      setQuickActionMode(isQuickMode);
      if (isQuickMode) {
        // Set compact window on load if quick action mode is enabled
        window.electronAPI.setWindowCompact(true);
      }
    });

    console.log('[Renderer] Setting up clipboard listener');
    window.electronAPI.onClipboardText((payload) => {
      console.log('[Renderer] >>> Clipboard text received! <<<');
      const { text, capturedContext, isSourceAppBlocked: blocked } = payload;
      console.log('[Renderer] Text length:', text?.length, 'Preview:', text?.substring(0, 50));
      console.log('[Renderer] Source app blocked:', blocked);
      if (capturedContext?.project) {
        console.log('[Renderer] Captured project:', capturedContext.project.projectPath);
      }
      console.log('[Renderer] Calling setOriginalPrompt and analyzePrompt');
      // Clear empty state when text is received
      setEmptyState(null);
      setOriginalPrompt(text);
      setIsSourceAppBlocked(blocked);
      analyzePrompt(text);
    });
    console.log('[Renderer] Clipboard listener registered');

    // Listen for empty state (no text captured on hotkey)
    window.electronAPI.onEmptyState((payload) => {
      console.log('[Renderer] Empty state received:', payload.reason, 'app:', payload.appName);
      // Clear any previous analysis and show contextual guidance
      setAnalysis(null);
      setOriginalPrompt('');
      setEmptyState(payload);
    });
    console.log('[Renderer] Empty state listener registered');

    // Listen for project changes (polling)
    window.electronAPI.onProjectChanged((project) => {
      console.log('[Renderer] Project changed:', project?.projectPath);
      setCurrentProject(project as DetectedProject | null);
    });

    // Listen for navigation events (from tray menu)
    window.electronAPI.onNavigate((view) => {
      console.log('[Renderer] Navigate to:', view);
      if (view === 'stats' || view === 'progress') {
        setViewMode('progress');
      } else if (view === 'help') {
        setViewMode('help');
      } else if (view === 'tips') {
        setViewMode('tips');
      } else {
        setViewMode('analysis');
      }
    });

    // Listen for shortcut registration failures
    window.electronAPI.onShortcutFailed((data) => {
      console.log('[Renderer] Shortcut registration failed:', data);
      setShortcutError(data);
    });

    return () => {
      window.electronAPI.removeClipboardListener();
      window.electronAPI.removeEmptyStateListener();
      window.electronAPI.removeProjectListener();
      window.electronAPI.removeNavigateListener();
      window.electronAPI.removeShortcutFailedListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // analyzePrompt is stable (useCallback with empty deps), mount-only effect

  const analyzePrompt = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsAnalyzing(true);
    try {
      // Call the analysis engine via IPC
      const result = await window.electronAPI.analyzePrompt(text);
      const analysisResult = result as AnalysisResult;
      setAnalysis(analysisResult);

      // Phase 3.1: Check if AI variant needs async loading
      const aiVariantIndex = analysisResult.promptVariants?.findIndex(
        (v: RewriteResult) => v.variant === 'ai' && v.isLoading
      );

      if (aiVariantIndex !== undefined && aiVariantIndex >= 0) {
        console.log('[Renderer] AI variant loading async...');
        // Load AI variant asynchronously (don't await, fire-and-forget)
        window.electronAPI.getAIVariant(text).then((aiVariant: AIVariantResult) => {
          console.log('[Renderer] AI variant loaded:', aiVariant?.isAiGenerated);
          // Update the analysis with the loaded AI variant
          setAnalysis((prev) => {
            if (!prev) return prev;
            const updatedVariants = [...prev.promptVariants];
            if (updatedVariants[aiVariantIndex]) {
              updatedVariants[aiVariantIndex] = aiVariant as RewriteResult;
            }
            return { ...prev, promptVariants: updatedVariants };
          });
        }).catch((err: unknown) => {
          console.error('[Renderer] AI variant loading failed:', err);
          // Update with error state
          setAnalysis((prev) => {
            if (!prev) return prev;
            const updatedVariants = [...prev.promptVariants];
            if (updatedVariants[aiVariantIndex]) {
              updatedVariants[aiVariantIndex] = {
                ...updatedVariants[aiVariantIndex],
                isLoading: false,
                needsSetup: false,
              };
            }
            return { ...prev, promptVariants: updatedVariants };
          });
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('timeout') || errorMessage.includes('network');
      const isDbError = errorMessage.includes('데이터베이스') || errorMessage.includes('database');

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
            message: isDbError
              ? '데이터베이스 연결 실패'
              : isNetworkError
                ? '네트워크 연결 문제'
                : '분석 엔진 연결 실패',
            suggestion: isDbError
              ? '디스크 공간을 확인하고 앱을 다시 시작해보세요'
              : isNetworkError
                ? 'AI 기능은 오프라인에서도 작동합니다. 잠시 후 다시 시도해주세요'
                : '앱을 다시 시작해보세요. 문제가 지속되면 앱을 재설치해주세요',
          },
        ],
        personalTips: ['기본 분석 모드로 전환됨'],
        improvedPrompt: undefined,
        promptVariants: [],
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await window.electronAPI.setClipboard(text);

      // Check hideOnCopy setting and close window if enabled
      const settings = await window.electronAPI.getSettings();
      console.log('[App] handleCopy - hideOnCopy setting:', settings.hideOnCopy);
      if (settings.hideOnCopy) {
        console.log('[App] Hiding window after copy');
        await window.electronAPI.hideWindow();
      }
    } catch (error) {
      console.error('[App] handleCopy error:', error);
    }
  };

  const handleApply = async (text: string): Promise<{ success: boolean; message?: string }> => {
    const result = await window.electronAPI.applyImprovedPrompt(text);
    return {
      success: result.success,
      message: result.message,
    };
  };

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const handleNewAnalysis = () => {
    setAnalysis(null);
    setOriginalPrompt('');
    setEmptyState(null);
    setShowDirectInput(true);
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

  // Get projected grade from score
  const getGradeFromScore = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  // Find best variant for Quick Action Mode
  const bestVariant = useMemo(() => {
    if (!analysis || !analysis.promptVariants || analysis.promptVariants.length === 0) {
      return null;
    }
    // Find variant with highest confidence (projected score)
    return analysis.promptVariants.reduce((best, current) => {
      // Skip loading or needs-setup variants
      if (current.isLoading || current.needsSetup) return best;
      if (!best || current.confidence > best.confidence) return current;
      return best;
    }, null as typeof analysis.promptVariants[0] | null);
  }, [analysis]);

  // Quick Action handlers
  const handleQuickApply = useCallback(async () => {
    if (!bestVariant) return;
    setQuickActionApplying(true);
    setQuickActionResult(null);
    try {
      const result = await window.electronAPI.applyImprovedPrompt(bestVariant.rewrittenPrompt);
      setQuickActionResult(result);
      if (result.success) {
        // Auto-hide after successful apply
        setTimeout(() => window.electronAPI.hideWindow(), 1500);
      }
    } catch {
      setQuickActionResult({ success: false, message: '적용 실패' });
    } finally {
      setQuickActionApplying(false);
    }
  }, [bestVariant]);

  const handleQuickCopy = useCallback(async () => {
    if (!bestVariant) return;
    await window.electronAPI.setClipboard(bestVariant.rewrittenPrompt);
    setQuickActionCopied(true);
    setTimeout(() => setQuickActionCopied(false), 2000);
  }, [bestVariant]);

  const exitQuickActionMode = useCallback(() => {
    setQuickActionMode(false);
    // Persist to settings and resize window
    window.electronAPI.setSetting('quickActionMode', false);
    window.electronAPI.setWindowCompact(false);
  }, []);

  // Keyboard shortcuts: Escape to hide, Cmd+Enter to apply in quick action mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.hideWindow();
        return;
      }

      // Cmd+Enter in quick action mode → apply best variant
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && quickActionMode && bestVariant && !isSourceAppBlocked) {
        e.preventDefault();
        handleQuickApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickActionMode, bestVariant, isSourceAppBlocked, handleQuickApply]);

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
            {viewMode === 'analysis' ? 'PromptLint' : viewMode === 'progress' ? '내 진행 상황' : viewMode === 'tips' ? '맞춤 팁' : '기능 안내'}
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
          {viewMode === 'analysis' && analysis && (
            <button
              onClick={handleNewAnalysis}
              className="p-1.5 rounded-md hover:bg-dark-hover transition-colors"
              title="새 분석"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'help' ? 'analysis' : 'help')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'help' ? 'bg-accent-primary/20 text-accent-primary' : 'hover:bg-dark-hover'}`}
            title="기능 안내"
          >
            <HelpCircle size={14} />
          </button>
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

      {/* Shortcut Error Notification */}
      {shortcutError && (
        <div className="bg-amber-900/50 border-b border-amber-600/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-200 text-sm">
            <span>⚠️</span>
            <span>{shortcutError.message}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded"
            >
              설정
            </button>
            <button
              onClick={() => setShortcutError(null)}
              className="text-amber-400 hover:text-amber-200"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {viewMode === 'help' ? (
          <HelpView />
        ) : viewMode === 'progress' ? (
          <ProgressTracker />
        ) : viewMode === 'tips' ? (
          <PersonalTips currentTips={analysis?.personalTips} />
        ) : isAnalyzing ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : analysis ? (
          <>
            {quickActionMode ? (
              /* Quick Action Mode: Enhanced Minimal UI */
              <div className="space-y-4">
                {/* Grade & Score Comparison */}
                <div className="flex items-center justify-center gap-4">
                  {/* Current */}
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getGradeColor(analysis.grade)}`}>
                      {analysis.grade}
                    </div>
                    <div className="text-sm text-gray-500">{analysis.overallScore}%</div>
                  </div>

                  {/* Arrow */}
                  {bestVariant && (
                    <>
                      <ArrowRight size={24} className="text-gray-600" />

                      {/* Projected */}
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getGradeColor(getGradeFromScore(bestVariant.confidence))}`}>
                          {getGradeFromScore(bestVariant.confidence)}
                        </div>
                        <div className="text-sm text-accent-success">
                          {Math.round(bestVariant.confidence)}%
                          <span className="text-xs ml-1 text-accent-success/70">
                            (+{Math.round(bestVariant.confidence - analysis.overallScore)})
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Variant Label */}
                {bestVariant && (
                  <div className="text-center text-xs text-gray-500">
                    {bestVariant.variantLabel} 변형
                  </div>
                )}

                {/* Result Message */}
                {quickActionResult && (
                  <div
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      quickActionResult.success
                        ? 'bg-accent-success/20 text-accent-success'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {quickActionResult.success ? <Check size={16} /> : null}
                    <span>{quickActionResult.message || (quickActionResult.success ? '적용됨!' : '적용 실패')}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Apply Button or Blocked Notice */}
                  {isSourceAppBlocked && bestVariant && (
                    <div
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 bg-dark-hover/50 cursor-not-allowed"
                      title="이 앱에서는 자동 적용이 지원되지 않습니다. 복사 후 수동으로 붙여넣어주세요."
                    >
                      <Play size={16} className="opacity-50" />
                      <span className="opacity-70">적용 불가</span>
                    </div>
                  )}
                  {!isSourceAppBlocked && bestVariant && (
                    <button
                      onClick={handleQuickApply}
                      disabled={quickActionApplying}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        quickActionApplying
                          ? 'bg-accent-primary/50 text-white/70 cursor-wait'
                          : 'bg-accent-primary hover:bg-accent-primary/90 text-white'
                      }`}
                    >
                      {quickActionApplying ? (
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
                  {bestVariant && (
                    <button
                      onClick={handleQuickCopy}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        quickActionCopied
                          ? 'bg-accent-success/20 text-accent-success'
                          : 'bg-dark-hover hover:bg-dark-border text-gray-300'
                      }`}
                    >
                      {quickActionCopied ? (
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
                  )}

                  {/* Full View Button */}
                  <button
                    onClick={exitQuickActionMode}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-dark-hover hover:bg-dark-border text-gray-400 transition-colors"
                    title="전체 분석 보기"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>

                {/* Keyboard shortcut hint */}
                <div className="text-center text-[10px] text-gray-600">
                  <kbd className="px-1 py-0.5 bg-dark-hover rounded">⌘</kbd>
                  <kbd className="px-1 py-0.5 bg-dark-hover rounded ml-0.5">Enter</kbd>
                  <span className="ml-1">적용</span>
                  <span className="mx-2">·</span>
                  <kbd className="px-1 py-0.5 bg-dark-hover rounded">Esc</kbd>
                  <span className="ml-1">닫기</span>
                </div>
              </div>
            ) : (
              /* Full Analysis Mode - 핵심 가치 중심 레이아웃 */
              <>
                {/* Session Context Indicator */}
                <ContextIndicator
                  context={analysis.sessionContext || (currentProject ? projectToContextInfo(currentProject) : null)}
                  onProjectSelect={handleProjectSelect}
                  onLoadProjects={loadAllProjects}
                />

                {/* [Hero] Prompt Comparison - Before→After 변환을 가장 먼저 */}
                {analysis.promptVariants.length > 0 && (
                  <PromptComparison
                    originalPrompt={originalPrompt}
                    variants={analysis.promptVariants}
                    onCopy={handleCopy}
                    onApply={isSourceAppBlocked ? undefined : handleApply}
                    onOpenSettings={() => setSettingsOpen(true)}
                  />
                )}

                {/* [Summary] 간략 GOLDEN Score + 접이식 토글 */}
                <div className="bg-dark-surface rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-gray-500">GOLDEN</span>
                        <div className="text-xl font-bold">{analysis.overallScore}%</div>
                      </div>
                      <span
                        className={`grade-badge text-3xl font-bold ${getGradeColor(analysis.grade)}`}
                      >
                        {analysis.grade}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
                    >
                      {showDetails ? (
                        <>
                          <ChevronUp size={14} />
                          <span>접기</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          <span>세부 분석</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 핵심 개선점 한 줄 요약 */}
                  {analysis.issues.length > 0 && !showDetails && (
                    <div className="mt-3 pt-3 border-t border-dark-border">
                      <div className="flex items-start gap-2 text-sm">
                        <Lightbulb size={14} className="text-accent-warning mt-0.5 flex-shrink-0" />
                        <span className="text-gray-400">
                          {analysis.issues[0].suggestion}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* [Expandable] 세부 분석 - 접이식 */}
                {showDetails && (
                  <div className="space-y-4">
                    {/* Radar Chart */}
                    <div className="bg-dark-surface rounded-lg p-4">
                      <div className="flex justify-center">
                        <GoldenRadar scores={analysis.goldenScores} size={180} />
                      </div>
                    </div>

                    {/* Issues */}
                    <IssueList issues={analysis.issues} />

                    {/* History-based Recommendations */}
                    {(analysis.historyRecommendations?.length || analysis.comparisonWithHistory?.improvement) && (
                      <HistoryRecommendations
                        recommendations={analysis.historyRecommendations || []}
                        comparisonWithHistory={analysis.comparisonWithHistory}
                      />
                    )}

                    {/* Personal Tips */}
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
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col h-full">
            {/* Show current project from polling even without analysis */}
            <ContextIndicator
              context={currentProject ? projectToContextInfo(currentProject) : null}
              onProjectSelect={handleProjectSelect}
              onLoadProjects={loadAllProjects}
            />

            {/* Contextual Empty State or Usage Guide */}
            {!showDirectInput && (
              <div className="flex-1 flex flex-col items-center justify-center px-4">
                {/* Contextual guidance when no text captured */}
                {emptyState ? (
                  <>
                    {emptyState.reason === 'blocked-app' ? (
                      <>
                        <div className="w-12 h-12 mb-4 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-2xl">📋</span>
                        </div>
                        <h2 className="text-base font-semibold text-gray-200 mb-2">클립보드 모드</h2>
                        <p className="text-sm text-gray-400 text-center mb-4">
                          <span className="text-amber-400 font-medium">{emptyState.appName || '현재 앱'}</span>에서는
                          <br />텍스트를 먼저 복사해주세요
                        </p>
                        <div className="w-full max-w-xs space-y-3 text-left">
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg border border-amber-500/20">
                            <div className="flex-shrink-0 w-6 h-6 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">텍스트 복사</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">C</kbd>로 복사
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                            <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">2</div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">분석 실행</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⇧</kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">P</kbd> 다시 누르기
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-xs text-blue-400/90">
                            ℹ️ 일부 앱(VS Code, Cursor 등)에서는 자동 선택이 지원되지 않습니다
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 mb-4 bg-accent-primary/20 rounded-full flex items-center justify-center">
                          <BarChart3 size={24} className="text-accent-primary" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-200 mb-2">텍스트를 선택해주세요</h2>
                        <p className="text-sm text-gray-400 text-center mb-4">
                          분석할 프롬프트를 선택하거나 복사해주세요
                        </p>
                        <div className="w-full max-w-xs space-y-3 text-left">
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg border border-accent-primary/20">
                            <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">1</div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">텍스트 선택</p>
                              <p className="text-xs text-gray-500 mt-0.5">드래그하여 텍스트 선택 또는 Cmd+C로 복사</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                            <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">2</div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">분석 실행</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⇧</kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">P</kbd> 다시 누르기
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <BarChart3 size={40} className="mb-4 text-accent-primary opacity-70" />
                    <h2 className="text-base font-semibold text-gray-200 mb-4">프롬프트 품질 개선하기</h2>

                    {/* Step-by-step guide */}
                    <div className="w-full max-w-xs space-y-3 text-left">
                      {/* Step 1 */}
                      <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">프롬프트 선택</p>
                          <p className="text-xs text-gray-500 mt-0.5">개선하고 싶은 텍스트를 드래그해서 선택</p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">분석 실행</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⇧</kbd>{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">P</kbd> 누르기
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">3</div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">개선안 적용</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="text-accent-success">[적용]</span> 버튼 또는{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">⌘</kbd>{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">Enter</kbd>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tip */}
                    <div className="mt-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-400/90">
                        💡 적용하면 원본 텍스트가 자동으로 개선된 프롬프트로 교체됩니다
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Direct input area */}
            {showDirectInput && (
              <div className="flex-1 flex flex-col space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    // Auto-expand: adjust height based on content
                    const target = e.target;
                    target.style.height = 'auto';
                    target.style.height = `${Math.max(96, Math.min(target.scrollHeight, 300))}px`;
                  }}
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
                  className="w-full p-3 bg-dark-hover border border-dark-border rounded-lg text-sm resize-y focus:outline-none focus:ring-1 focus:ring-accent-primary placeholder-gray-600 min-h-[96px] max-h-[300px] transition-colors"
                  style={{ height: '96px' }}
                  autoFocus
                />
                <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
                  <span>{inputText.length}자</span>
                  <span>⌘+Enter로 분석</span>
                </div>
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
        <div className="p-4 border-t border-dark-border bg-dark-surface">
          {/* Progress button */}
          <button
            onClick={() => setViewMode('progress')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-dark-hover hover:bg-dark-border rounded-lg text-sm transition-colors"
          >
            <BarChart3 size={16} />
            <span>내 진행 상황 보기</span>
          </button>
        </div>
      )}

      {/* Settings Modal */}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
