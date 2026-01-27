import { useReducer, useEffect, useCallback, useRef } from 'react';
import type { RewriteResult } from '../components/PromptComparison';
import type { SessionContextInfo } from '../components/ContextIndicator';
import type { DetectedProject, EmptyStatePayload, HistoryRecommendation } from '../electron.d';
import { initializeLanguage, changeLanguage } from '../../locales';

// Renderer-specific AnalysisResult:
// - Uses PromptComparison's RewriteResult (has isLoading, needsSetup, provider fields)
// - Makes promptVariants required (IPC always returns it)
export interface AnalysisResult {
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
    category: string;
    message: string;
    suggestion: string;
  }>;
  personalTips: string[];
  improvedPrompt?: string;
  promptVariants: RewriteResult[];
  sessionContext?: SessionContextInfo;
  historyRecommendations?: HistoryRecommendation[];
  comparisonWithHistory?: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
}

export type ViewMode = 'analysis' | 'progress' | 'tips' | 'help';

// --- State ---

export interface AppState {
  // Analysis
  originalPrompt: string;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  showDetails: boolean;
  emptyState: EmptyStatePayload | null;
  isSourceAppBlocked: boolean;
  // UI
  viewMode: ViewMode;
  settingsOpen: boolean;
  showDirectInput: boolean;
  inputText: string;
  showOnboarding: boolean;
  // Context
  currentProject: DetectedProject | null;
  shortcutError: { shortcut: string; message: string } | null;
}

const initialState: AppState = {
  originalPrompt: '',
  analysis: null,
  isAnalyzing: false,
  showDetails: false,
  emptyState: null,
  isSourceAppBlocked: false,
  viewMode: 'analysis',
  settingsOpen: false,
  showDirectInput: false,
  inputText: '',
  showOnboarding: false,
  currentProject: null,
  shortcutError: null,
};

// --- Actions ---

export type AppAction =
  // Analysis flow
  | { type: 'RECEIVE_TEXT'; prompt: string; isSourceAppBlocked: boolean }
  | { type: 'RECEIVE_EMPTY_STATE'; payload: EmptyStatePayload }
  | { type: 'START_ANALYSIS' }
  | { type: 'SET_ANALYSIS'; result: AnalysisResult }
  | { type: 'UPDATE_AI_VARIANT'; index: number; variant: RewriteResult }
  | { type: 'FINISH_ANALYSIS' }
  | { type: 'CLEAR_ANALYSIS' }
  | { type: 'TOGGLE_DETAILS' }
  // UI
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'SET_SHOW_DIRECT_INPUT'; show: boolean }
  | { type: 'SET_INPUT_TEXT'; text: string }
  | { type: 'SHOW_ONBOARDING' }
  | { type: 'DISMISS_ONBOARDING' }
  // Context
  | { type: 'SET_PROJECT'; project: DetectedProject | null }
  | { type: 'SET_SHORTCUT_ERROR'; error: { shortcut: string; message: string } }
  | { type: 'CLEAR_SHORTCUT_ERROR' };

// --- Reducer ---

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Analysis flow
    case 'RECEIVE_TEXT':
      return {
        ...state,
        emptyState: null,
        originalPrompt: action.prompt,
        isSourceAppBlocked: action.isSourceAppBlocked,
      };
    case 'RECEIVE_EMPTY_STATE':
      return {
        ...state,
        analysis: null,
        originalPrompt: '',
        emptyState: action.payload,
      };
    case 'START_ANALYSIS':
      return { ...state, isAnalyzing: true };
    case 'SET_ANALYSIS':
      return { ...state, analysis: action.result };
    case 'UPDATE_AI_VARIANT': {
      if (!state.analysis) return state;
      const updatedVariants = [...state.analysis.promptVariants];
      if (updatedVariants[action.index]) {
        updatedVariants[action.index] = action.variant;
      }
      return { ...state, analysis: { ...state.analysis, promptVariants: updatedVariants } };
    }
    case 'FINISH_ANALYSIS':
      return { ...state, isAnalyzing: false };
    case 'CLEAR_ANALYSIS':
      return {
        ...state,
        analysis: null,
        originalPrompt: '',
        emptyState: null,
        showDirectInput: true,
      };
    case 'TOGGLE_DETAILS':
      return { ...state, showDetails: !state.showDetails };

    // UI
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'OPEN_SETTINGS':
      return { ...state, settingsOpen: true };
    case 'CLOSE_SETTINGS':
      return { ...state, settingsOpen: false };
    case 'SET_SHOW_DIRECT_INPUT':
      return { ...state, showDirectInput: action.show };
    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.text };
    case 'SHOW_ONBOARDING':
      return { ...state, showOnboarding: true };
    case 'DISMISS_ONBOARDING':
      return { ...state, showOnboarding: false };

    // Context
    case 'SET_PROJECT':
      return { ...state, currentProject: action.project };
    case 'SET_SHORTCUT_ERROR':
      return { ...state, shortcutError: action.error };
    case 'CLEAR_SHORTCUT_ERROR':
      return { ...state, shortcutError: null };

    default:
      return state;
  }
}

// --- Hook ---

export function useAppState(te: (key: string) => string) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Ref to avoid stale closure in mount-only IPC effect.
  // analyzePrompt depends on `te` which changes on language switch;
  // the ref always points to the latest version.
  const analyzePromptRef = useRef<((text: string) => Promise<void>) | null>(null);

  // --- Callbacks ---

  const analyzePrompt = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      dispatch({ type: 'START_ANALYSIS' });
      try {
        const result = await window.electronAPI.analyzePrompt(text);
        // Map IPC result (AnalysisResultWithContext) to renderer's AnalysisResult.
        // The IPC result has promptVariants as optional; default to empty array.
        const analysisResult: AnalysisResult = {
          ...result,
          promptVariants: result.promptVariants ?? [],
        };
        dispatch({ type: 'SET_ANALYSIS', result: analysisResult });

        // Phase 3.1: Check if AI variant needs async loading
        const aiVariantIndex = analysisResult.promptVariants.findIndex(
          (v) => v.variant === 'ai' && v.isLoading
        );

        if (aiVariantIndex >= 0) {
          console.log('[Renderer] AI variant loading async...');
          window.electronAPI
            .getAIVariant(text)
            .then((aiVariant) => {
              console.log('[Renderer] AI variant loaded:', aiVariant?.isAiGenerated);
              dispatch({
                type: 'UPDATE_AI_VARIANT',
                index: aiVariantIndex,
                variant: { ...aiVariant, isLoading: false },
              });
            })
            .catch((err: unknown) => {
              console.error('[Renderer] AI variant loading failed:', err);
              dispatch({
                type: 'UPDATE_AI_VARIANT',
                index: aiVariantIndex,
                variant: {
                  ...analysisResult.promptVariants[aiVariantIndex],
                  isLoading: false,
                  needsSetup: false,
                },
              });
            });
        }
      } catch (error) {
        console.error('Analysis failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          errorMessage.includes('timeout') || errorMessage.includes('network');
        const isDbError =
          errorMessage.includes('데이터베이스') || errorMessage.includes('database');

        dispatch({
          type: 'SET_ANALYSIS',
          result: {
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
                  ? te('storage.databaseError')
                  : isNetworkError
                    ? te('network.failed')
                    : te('analysis.failed'),
                suggestion: te('general.tryAgain'),
              },
            ],
            personalTips: [],
            improvedPrompt: undefined,
            promptVariants: [],
          },
        });
      } finally {
        dispatch({ type: 'FINISH_ANALYSIS' });
      }
    },
    [te]
  );
  analyzePromptRef.current = analyzePrompt;

  const handleCopy = useCallback(async (text: string) => {
    try {
      await window.electronAPI.setClipboard(text);
      const settings = await window.electronAPI.getSettings();
      console.log('[App] handleCopy - hideOnCopy setting:', settings.hideOnCopy);
      if (settings.hideOnCopy) {
        console.log('[App] Hiding window after copy');
        await window.electronAPI.hideWindow();
      }
    } catch (error) {
      console.error('[App] handleCopy error:', error);
    }
  }, []);

  const handleApply = useCallback(
    async (text: string): Promise<{ success: boolean; message?: string }> => {
      const result = await window.electronAPI.applyImprovedPrompt(text);
      return { success: result.success, message: result.message };
    },
    []
  );

  const handleClose = useCallback(() => {
    window.electronAPI.hideWindow();
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI.minimizeWindow();
  }, []);

  const handleNewAnalysis = useCallback(() => {
    dispatch({ type: 'CLEAR_ANALYSIS' });
  }, []);

  const dismissOnboarding = useCallback(() => {
    dispatch({ type: 'DISMISS_ONBOARDING' });
    window.electronAPI.setSetting('onboardingDismissed', true);
  }, []);

  const handleProjectSelect = useCallback(async (projectPath: string | null) => {
    try {
      await window.electronAPI.selectProject(projectPath);
      const project = await window.electronAPI.getCurrentProject();
      dispatch({ type: 'SET_PROJECT', project: project as DetectedProject | null });
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

  const handleDirectInputSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      dispatch({ type: 'RECEIVE_TEXT', prompt: text, isSourceAppBlocked: false });
      analyzePrompt(text);
      dispatch({ type: 'SET_SHOW_DIRECT_INPUT', show: false });
      dispatch({ type: 'SET_INPUT_TEXT', text: '' });
    },
    [analyzePrompt]
  );

  // --- IPC Listeners (mount-only) ---

  useEffect(() => {
    window.electronAPI.signalReady().then(() => {
      console.log('[Renderer] Signaled ready to main process');
    });

    initializeLanguage().then((lang) => {
      console.log('[Renderer] Language initialized:', lang);
    });

    window.electronAPI.onLanguageChanged(async (data) => {
      console.log('[Renderer] Language changed:', data.language, 'source:', data.source);
      await changeLanguage(data.language as 'en' | 'ko');
    });

    window.electronAPI.getCurrentProject().then((project) => {
      dispatch({ type: 'SET_PROJECT', project: project as DetectedProject | null });
    });

    window.electronAPI.getSettings().then((settings) => {
      const onboardingDismissed = (settings.onboardingDismissed as boolean) ?? false;
      if (!onboardingDismissed) {
        dispatch({ type: 'SHOW_ONBOARDING' });
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
      console.log('[Renderer] Dispatching RECEIVE_TEXT and analyzing');
      dispatch({ type: 'RECEIVE_TEXT', prompt: text, isSourceAppBlocked: blocked });
      analyzePromptRef.current?.(text);
    });
    console.log('[Renderer] Clipboard listener registered');

    window.electronAPI.onEmptyState((payload) => {
      console.log('[Renderer] Empty state received:', payload.reason, 'app:', payload.appName);
      dispatch({ type: 'RECEIVE_EMPTY_STATE', payload });
    });
    console.log('[Renderer] Empty state listener registered');

    window.electronAPI.onProjectChanged((project) => {
      console.log('[Renderer] Project changed:', project?.projectPath);
      dispatch({ type: 'SET_PROJECT', project: project as DetectedProject | null });
    });

    window.electronAPI.onNavigate((view) => {
      console.log('[Renderer] Navigate to:', view);
      if (view === 'stats' || view === 'progress') {
        dispatch({ type: 'SET_VIEW_MODE', mode: 'progress' });
      } else if (view === 'help') {
        dispatch({ type: 'SET_VIEW_MODE', mode: 'help' });
      } else if (view === 'tips') {
        dispatch({ type: 'SET_VIEW_MODE', mode: 'tips' });
      } else {
        dispatch({ type: 'SET_VIEW_MODE', mode: 'analysis' });
      }
    });

    window.electronAPI.onShortcutFailed((data) => {
      console.log('[Renderer] Shortcut registration failed:', data);
      dispatch({ type: 'SET_SHORTCUT_ERROR', error: data });
    });

    return () => {
      window.electronAPI.removeClipboardListener();
      window.electronAPI.removeEmptyStateListener();
      window.electronAPI.removeProjectListener();
      window.electronAPI.removeNavigateListener();
      window.electronAPI.removeShortcutFailedListener();
      window.electronAPI.removeLanguageChangedListener();
    };
  }, []); // mount-only: IPC listeners use refs for latest callbacks

  return {
    state,
    dispatch,
    analyzePrompt,
    handleCopy,
    handleApply,
    handleClose,
    handleMinimize,
    handleNewAnalysis,
    dismissOnboarding,
    handleProjectSelect,
    loadAllProjects,
    handleDirectInputSubmit,
  };
}
