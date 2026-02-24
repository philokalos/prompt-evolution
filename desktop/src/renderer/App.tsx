import { useEffect, useRef } from 'react';
import {
  X,
  Minus,
  BarChart3,
  Lightbulb,
  ArrowLeft,
  Settings as SettingsIcon,
  Edit3,
  Send,
  Plus,
  HelpCircle,
  Sparkles,
  FileText,
} from 'lucide-react';
import GoldenRadar from './components/GoldenRadar';
import ProgressTracker from './components/ProgressTracker';
import PersonalTips from './components/PersonalTips';
import HelpView from './components/HelpView';
import IssueList from './components/IssueList';
import PromptComparison from './components/PromptComparison';
import ImprovedPromptView from './components/ImprovedPromptView';
import TopFixCard from './components/TopFixCard';
import CollapsibleDetails from './components/CollapsibleDetails';
import ContextIndicator, { SessionContextInfo } from './components/ContextIndicator';
import HistoryRecommendations from './components/HistoryRecommendations';
import InstructionAnalysis from './components/InstructionAnalysis';
import InstructionEditor from './components/InstructionEditor';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import AboutDialog from './components/AboutDialog';
import type { DetectedProject } from './electron.d';
import { useTranslation } from 'react-i18next';
import { useAppState } from './hooks/useAppState';
import { useInstructionLinter } from './hooks/useInstructionLinter';

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
  const { t } = useTranslation('common');
  const { t: te } = useTranslation('errors');
  const { t: ta } = useTranslation('analysis');

  const {
    state,
    dispatch,
    handleCopy,
    handleApply,
    handleClose,
    handleMinimize,
    handleNewAnalysis,
    dismissOnboarding,
    handleOnboardingComplete,
    dismissAbout,
    handleProjectSelect,
    loadAllProjects,
    handleDirectInputSubmit,
  } = useAppState(te);

  const instructionLinter = useInstructionLinter();

  const {
    originalPrompt,
    analysis,
    isAnalyzing,
    emptyState,
    isSourceAppBlocked,
    viewMode,
    settingsOpen,
    showDirectInput,
    inputText,
    showOnboarding,
    showAbout,
    currentProject,
    shortcutError,
  } = state;

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

  // Track last analyzed project to detect changes (ref avoids setState-in-effect)
  const lastAnalyzedProjectRef = useRef<string | undefined>();

  // Auto-detect instruction files when switching to instructions view or project changes
  useEffect(() => {
    if (viewMode !== 'instructions') return;
    if (instructionLinter.isLoading) return;

    const projectPath = currentProject?.projectPath;
    if (!projectPath) return;

    // Project changed → clear previous results and re-detect
    if (projectPath !== lastAnalyzedProjectRef.current) {
      lastAnalyzedProjectRef.current = projectPath;
      instructionLinter.clearAnalysis();
      instructionLinter.detectFiles(projectPath);
      return;
    }

    // Same project, already analyzed → skip
    if (instructionLinter.analysis) return;
  }, [viewMode, currentProject?.projectPath, instructionLinter.analysis, instructionLinter.isLoading, instructionLinter.detectFiles, instructionLinter.clearAnalysis]);

  // Auto-lint the first detected file
  useEffect(() => {
    if (instructionLinter.detectedFiles.length > 0 && !instructionLinter.analysis && !instructionLinter.isLoading) {
      instructionLinter.lintFile(instructionLinter.detectedFiles[0].path);
    }
  }, [instructionLinter.detectedFiles, instructionLinter.analysis, instructionLinter.isLoading, instructionLinter.lintFile]);

  // Keyboard shortcuts: Escape to hide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.hideWindow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="window-container h-full flex flex-col text-gray-200">
      {/* Title Bar */}
      <div className="titlebar flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-surface">
        <div className="flex items-center gap-2">
          {viewMode !== 'analysis' && (
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'analysis' })}
              className="p-1 rounded-md hover:bg-dark-hover transition-colors"
              aria-label={t('back')}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <span className="text-sm font-semibold">
            {viewMode === 'analysis'
              ? t('navigation.analysis')
              : viewMode === 'progress'
                ? t('navigation.progress')
                : viewMode === 'tips'
                  ? t('navigation.tips')
                  : viewMode === 'instructions'
                    ? ta('instructionLinter.viewMode')
                    : t('navigation.help')}
          </span>
          {viewMode === 'analysis' && analysis && (
            <span className={`grade-badge text-2xl font-bold ${getGradeColor(analysis.grade)}`}>
              {analysis.grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {viewMode === 'analysis' && analysis && (
            <button
              onClick={handleNewAnalysis}
              className="p-1.5 rounded-md hover:bg-dark-hover transition-colors"
              title={t('newAnalysis')}
              aria-label={t('newAnalysis')}
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={() =>
              dispatch({
                type: 'SET_VIEW_MODE',
                mode: viewMode === 'instructions' ? 'analysis' : 'instructions',
              })
            }
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'instructions' ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-dark-hover'}`}
            title={ta('instructionLinter.viewMode')}
            aria-label={ta('instructionLinter.viewMode')}
          >
            <FileText size={14} />
          </button>
          <button
            onClick={() =>
              dispatch({
                type: 'SET_VIEW_MODE',
                mode: viewMode === 'help' ? 'analysis' : 'help',
              })
            }
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'help' ? 'bg-accent-primary/20 text-accent-primary' : 'hover:bg-dark-hover'}`}
            title={t('navigation.help')}
            aria-label={t('navigation.help')}
          >
            <HelpCircle size={14} />
          </button>
          <button
            onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            className="p-1.5 rounded-md hover:bg-dark-hover transition-colors"
            title={t('settings')}
            aria-label={t('settings')}
          >
            <SettingsIcon size={14} />
          </button>
          <button
            onClick={handleMinimize}
            className="p-1.5 rounded-md hover:bg-dark-hover transition-colors"
            aria-label={t('minimize')}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"
            aria-label={t('close')}
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
              onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded"
            >
              {t('settings')}
            </button>
            <button
              onClick={() => dispatch({ type: 'CLEAR_SHORTCUT_ERROR' })}
              className="text-amber-400 hover:text-amber-200"
              aria-label={t('dismiss')}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {viewMode === 'instructions' ? (
          instructionLinter.analysis ? (
            <InstructionAnalysis analysis={instructionLinter.analysis} />
          ) : instructionLinter.generatedDraft ? (
            <InstructionEditor
              draft={instructionLinter.generatedDraft.draft}
              detectedStack={instructionLinter.generatedDraft.detectedStack}
              confidence={instructionLinter.generatedDraft.confidence}
              projectPath={currentProject?.projectPath ?? ''}
              onSave={instructionLinter.saveInstructionFile}
              onSaved={() => {
                if (currentProject?.projectPath) {
                  const filePath = `${currentProject.projectPath}/CLAUDE.md`;
                  instructionLinter.lintFile(filePath);
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              {instructionLinter.isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent mb-4" />
                  <p className="text-sm text-gray-400">{ta('instructionLinter.analyzing')}</p>
                </>
              ) : currentProject?.projectPath ? (
                <>
                  <FileText size={36} className="mb-3 text-indigo-400 opacity-70" />
                  <h2 className="text-base font-semibold text-gray-200 mb-1">
                    {ta('instructionLinter.noFile')}
                  </h2>
                  <p className="text-xs text-gray-500 mb-1 font-mono truncate max-w-full">
                    {currentProject.projectPath}
                  </p>
                  <p className="text-sm text-gray-400 mb-5">
                    {ta('instructionLinter.generator.description')}
                  </p>
                  <button
                    onClick={() => instructionLinter.generateClaudeMd(currentProject.projectPath)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    <Sparkles size={16} />
                    {ta('instructionLinter.generator.generate')}
                  </button>
                  {instructionLinter.error && (
                    <p className="text-xs text-red-400 mt-3">{instructionLinter.error}</p>
                  )}
                </>
              ) : (
                <>
                  <FileText size={36} className="mb-3 text-gray-500 opacity-50" />
                  <h2 className="text-base font-semibold text-gray-200 mb-2">
                    {ta('instructionLinter.title')}
                  </h2>
                  <p className="text-sm text-gray-400 mb-1">
                    {ta('instructionLinter.noProject')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ta('instructionLinter.noProjectHint')}
                  </p>
                </>
              )}
            </div>
          )
        ) : viewMode === 'help' ? (
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
            {/* 1. Context Indicator */}
            <ContextIndicator
              context={
                analysis.sessionContext ||
                (currentProject ? projectToContextInfo(currentProject) : null)
              }
              onProjectSelect={handleProjectSelect}
              onLoadProjects={loadAllProjects}
            />

            {/* 2. Improved Prompt — above fold, one-click action */}
            {analysis.promptVariants.length > 0 && (
              <ImprovedPromptView
                variants={analysis.promptVariants}
                grade={analysis.grade}
                isSourceAppBlocked={isSourceAppBlocked}
                onApply={isSourceAppBlocked ? undefined : handleApply}
                onCopy={handleCopy}
                contextIncluded={!!analysis.sessionContext}
              />
            )}

            {/* 3. Top Fix — single most impactful improvement */}
            {analysis.topFix && (
              <TopFixCard
                topFix={analysis.topFix}
                onShowAllIssues={
                  analysis.issues.length > 1
                    ? () => dispatch({ type: 'SET_VIEW_MODE', mode: 'progress' })
                    : undefined
                }
              />
            )}

            {/* 4. Detailed Analysis — collapsed by default */}
            <CollapsibleDetails>
              {/* Variant comparison */}
              {analysis.promptVariants.length > 0 && (
                <PromptComparison
                  originalPrompt={originalPrompt}
                  variants={analysis.promptVariants}
                  onCopy={handleCopy}
                  onApply={isSourceAppBlocked ? undefined : handleApply}
                  onOpenSettings={() => dispatch({ type: 'OPEN_SETTINGS' })}
                />
              )}

              {/* Issues */}
              {analysis.issues.length > 0 && (
                <IssueList
                  issues={analysis.issues}
                />
              )}

              {/* GOLDEN Radar */}
              <div className="bg-dark-surface rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-400">GOLDEN Score</span>
                  <span className={`text-lg font-bold ${getGradeColor(analysis.grade)}`}>
                    {analysis.overallScore}%
                  </span>
                  <span className={`grade-badge text-xl font-bold ${getGradeColor(analysis.grade)}`}>
                    {analysis.grade}
                  </span>
                </div>
                <div className="flex justify-center">
                  <GoldenRadar scores={analysis.goldenScores} size={120} />
                </div>
              </div>

              {/* History Recommendations */}
              {(analysis.historyRecommendations?.length ||
                analysis.comparisonWithHistory?.improvement) && (
                <HistoryRecommendations
                  recommendations={analysis.historyRecommendations || []}
                  comparisonWithHistory={analysis.comparisonWithHistory}
                />
              )}

              {/* Personal Tips */}
              {analysis.personalTips.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <Lightbulb size={14} className="text-accent-primary" />
                    <span>Tips</span>
                  </div>
                  <div className="bg-dark-surface rounded-lg p-3 space-y-2">
                    {analysis.personalTips.slice(0, 2).map((tip, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs">
                        <span className="text-accent-secondary">•</span>
                        <span className="text-gray-400">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleDetails>
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
                        <h2 className="text-base font-semibold text-gray-200 mb-2">
                          {t('emptyState.blockedApp.title')}
                        </h2>
                        <p className="text-sm text-gray-400 text-center mb-4">
                          <span className="text-amber-400 font-medium">
                            {emptyState.appName || t('appName')}
                          </span>
                          <br />
                          {t('emptyState.blockedApp.description')}
                        </p>
                        <div className="w-full max-w-xs space-y-3 text-left">
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg border border-amber-500/20">
                            <div className="flex-shrink-0 w-6 h-6 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-xs font-bold">
                              1
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">
                                {t('emptyState.blockedApp.step1Title')}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  ⌘
                                </kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  C
                                </kbd>{' '}
                                {t('emptyState.blockedApp.step1Desc')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                            <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">
                              2
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">
                                {t('emptyState.blockedApp.step2Title')}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  ⌘
                                </kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  ⇧
                                </kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  P
                                </kbd>{' '}
                                {t('emptyState.blockedApp.step2Desc')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-xs text-blue-400/90">
                            {t('emptyState.blockedApp.note')}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 mb-4 bg-accent-primary/20 rounded-full flex items-center justify-center">
                          <BarChart3 size={24} className="text-accent-primary" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-200 mb-2">
                          {t('emptyState.noSelection.title')}
                        </h2>
                        <p className="text-sm text-gray-400 text-center mb-4">
                          {t('emptyState.noSelection.description')}
                        </p>
                        <div className="w-full max-w-xs space-y-3 text-left">
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg border border-accent-primary/20">
                            <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">
                              1
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">
                                {t('emptyState.noSelection.step1Title')}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {t('emptyState.noSelection.step1Desc')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                            <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">
                              2
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-200">
                                {t('emptyState.noSelection.step2Title')}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  ⌘
                                </kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  ⇧
                                </kbd>{' '}
                                <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                                  P
                                </kbd>{' '}
                                {t('emptyState.noSelection.step2Desc')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* First launch onboarding card */}
                    {showOnboarding && (
                      <div className="w-full max-w-xs mb-4 p-4 bg-gradient-to-br from-accent-primary/20 to-purple-500/20 border border-accent-primary/30 rounded-xl relative">
                        <button
                          onClick={dismissOnboarding}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-200 transition-colors"
                          aria-label={t('close')}
                        >
                          <X size={14} />
                        </button>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={18} className="text-accent-primary" />
                          <h3 className="text-sm font-semibold text-gray-100">
                            {t('emptyState.onboarding.title')}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed mb-3">
                          {t('emptyState.onboarding.description')}
                          <br />
                          {t('emptyState.onboarding.subDescription')}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="px-1.5 py-0.5 bg-dark-surface/50 rounded">
                            {t('emptyState.onboarding.tags.free')}
                          </span>
                          <span className="px-1.5 py-0.5 bg-dark-surface/50 rounded">
                            {t('emptyState.onboarding.tags.offline')}
                          </span>
                          <span className="px-1.5 py-0.5 bg-dark-surface/50 rounded">
                            {t('emptyState.onboarding.tags.privacy')}
                          </span>
                        </div>
                      </div>
                    )}

                    <BarChart3 size={40} className="mb-4 text-accent-primary opacity-70" />
                    <h2 className="text-base font-semibold text-gray-200 mb-4">
                      {t('emptyState.welcome.title')}
                    </h2>

                    {/* Step-by-step guide */}
                    <div className="w-full max-w-xs space-y-3 text-left">
                      {/* Step 1 */}
                      <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">
                          1
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {t('emptyState.welcome.step1Title')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t('emptyState.welcome.step1Desc')}
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">
                          2
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {t('emptyState.welcome.step2Title')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                              ⌘
                            </kbd>{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                              ⇧
                            </kbd>{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                              P
                            </kbd>{' '}
                            {t('emptyState.welcome.step2Desc')}
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-start gap-3 p-3 bg-dark-surface rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center text-xs font-bold">
                          3
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {t('emptyState.welcome.step3Title')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="text-accent-success">[{t('apply')}]</span>{' '}
                            {t('emptyState.welcome.step3Desc')}{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                              ⌘
                            </kbd>{' '}
                            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded text-[10px]">
                              Enter
                            </kbd>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tip */}
                    <div className="mt-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-400/90">{t('emptyState.welcome.tip')}</p>
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
                    dispatch({ type: 'SET_INPUT_TEXT', text: e.target.value });
                    // Auto-expand: adjust height based on content
                    const target = e.target;
                    target.style.height = 'auto';
                    target.style.height = `${Math.max(96, Math.min(target.scrollHeight, 300))}px`;
                  }}
                  onKeyDown={(e) => {
                    // Cmd/Ctrl + Enter to submit
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && inputText.trim()) {
                      e.preventDefault();
                      handleDirectInputSubmit(inputText);
                    }
                  }}
                  placeholder={t('directInput.placeholder')}
                  className="w-full p-3 bg-dark-hover border border-dark-border rounded-lg text-sm resize-y focus:outline-none focus:ring-1 focus:ring-accent-primary placeholder-gray-600 min-h-[96px] max-h-[300px] transition-colors"
                  style={{ height: '96px' }}
                  autoFocus
                />
                <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
                  <span>{t('directInput.charCount', { count: inputText.length })}</span>
                  <span>{t('directInput.submitHint')}</span>
                </div>
                <button
                  onClick={() => handleDirectInputSubmit(inputText)}
                  disabled={!inputText.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  <Send size={16} />
                  <span>{t('directInput.button')}</span>
                </button>
              </div>
            )}

            {/* Toggle button */}
            <div className="pt-4 border-t border-dark-border mt-4">
              <button
                onClick={() =>
                  dispatch({ type: 'SET_SHOW_DIRECT_INPUT', show: !showDirectInput })
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-lg transition-colors"
              >
                <Edit3 size={14} />
                <span>
                  {showDirectInput ? t('directInput.toggleBack') : t('directInput.toggle')}
                </span>
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
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: 'progress' })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-dark-hover hover:bg-dark-border rounded-lg text-sm transition-colors"
          >
            <BarChart3 size={16} />
            <span>{t('footer.viewProgress')}</span>
          </button>
        </div>
      )}

      {/* Settings Modal */}
      <Settings isOpen={settingsOpen} onClose={() => dispatch({ type: 'CLOSE_SETTINGS' })} />

      {/* Onboarding Modal */}
      <Onboarding isOpen={showOnboarding} onComplete={handleOnboardingComplete} />

      {/* About Dialog */}
      <AboutDialog isOpen={showAbout} onClose={dismissAbout} />
    </div>
  );
}

export default App;
