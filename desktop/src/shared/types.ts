// Shared types between main and renderer processes

export interface AnalysisResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  goldenScores: GoldenScores;
  issues: Issue[];
  personalTips: string[];
  improvedPrompt?: string;
  classification?: PromptClassification;
}

export interface GoldenScores {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
}

export interface Issue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  suggestion: string;
}

export interface PromptClassification {
  intent: PromptIntent;
  category: TaskCategory;
  confidence: number;
}

export type PromptIntent =
  | 'command'
  | 'question'
  | 'instruction'
  | 'feedback'
  | 'context'
  | 'clarification'
  | 'unknown';

export type TaskCategory =
  | 'code-generation'
  | 'code-review'
  | 'bug-fix'
  | 'refactoring'
  | 'explanation'
  | 'documentation'
  | 'testing'
  | 'architecture'
  | 'deployment'
  | 'data-analysis'
  | 'general'
  | 'unknown';

export interface UserSettings {
  shortcut: string;
  windowBounds: { width: number; height: number };
  alwaysOnTop: boolean;
  showTrayIcon: boolean;
  autoLaunch: boolean;
}

export interface PromptHistory {
  id: string;
  text: string;
  analysis: AnalysisResult;
  timestamp: Date;
}

export interface PersonalStats {
  totalPrompts: number;
  averageScore: number;
  topWeaknesses: string[];
  progressTrend: ProgressPoint[];
}

export interface ProgressPoint {
  date: string;
  averageScore: number;
  promptCount: number;
}

// Session context from active IDE window
export interface SessionContext {
  projectPath: string;
  projectId: string;
  sessionId: string;
  currentTask: string;
  techStack: string[];
  recentTools: string[];
  recentFiles: string[];
  lastActivity: Date;
  gitBranch?: string;
}

export interface ActiveSessionContext extends SessionContext {
  source: 'active-window' | 'app-path';
  ideName?: string;
  currentFile?: string;
  confidence: 'high' | 'medium' | 'low';
}

// Extended analysis result with session context
export interface AnalysisResultWithContext extends AnalysisResult {
  sessionContext?: ActiveSessionContext;
  promptVariants?: RewriteResult[];
  // Phase 2: History-based recommendations
  historyRecommendations?: HistoryRecommendation[];
  comparisonWithHistory?: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
}

export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: 'conservative' | 'balanced' | 'comprehensive' | 'ai';
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
}

// Phase 2: History-based recommendation types
export interface HistoryRecommendation {
  type: 'weakness' | 'improvement' | 'reference' | 'pattern';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  dimension?: string;
  examplePrompt?: string;
  improvement?: number;
}
