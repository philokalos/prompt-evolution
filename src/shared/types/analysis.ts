/**
 * Analysis Result Types
 * Shared types for prompt analysis results
 */

import type { Grade, GoldenScores } from './golden.js';
import type { PromptClassification } from './classification.js';

/**
 * Issue detected in prompt
 */
export interface Issue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  suggestion: string;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  overallScore: number;
  grade: Grade;
  goldenScores: GoldenScores;
  issues: Issue[];
  personalTips: string[];
  improvedPrompt?: string;
  classification?: PromptClassification;
}

/**
 * Extended analysis result with session context
 */
export interface AnalysisResultWithContext extends AnalysisResult {
  sessionContext?: ActiveSessionContext;
  promptVariants?: RewriteResult[];
  historyRecommendations?: HistoryRecommendation[];
  comparisonWithHistory?: {
    betterThanAverage: boolean;
    scoreDiff: number;
    improvement: string | null;
  } | null;
}

/**
 * Rewrite result for prompt variants
 */
export interface RewriteResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: 'conservative' | 'balanced' | 'comprehensive' | 'ai';
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
}

/**
 * History-based recommendation
 */
export interface HistoryRecommendation {
  type: 'weakness' | 'improvement' | 'reference' | 'pattern';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  dimension?: string;
  examplePrompt?: string;
  improvement?: number;
}

/**
 * Session context from active IDE window
 */
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

/**
 * Active session context with detection metadata
 */
export interface ActiveSessionContext extends SessionContext {
  source: 'active-window' | 'app-path';
  ideName?: string;
  currentFile?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Prompt history entry
 */
export interface PromptHistory {
  id: string;
  text: string;
  analysis: AnalysisResult;
  timestamp: Date;
}

/**
 * Personal statistics
 */
export interface PersonalStats {
  totalPrompts: number;
  averageScore: number;
  topWeaknesses: string[];
  progressTrend: ProgressPoint[];
}

/**
 * Progress data point
 */
export interface ProgressPoint {
  date: string;
  averageScore: number;
  promptCount: number;
}
