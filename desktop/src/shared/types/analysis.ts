/**
 * Analysis Types
 * Types for prompt analysis, scoring, and AI variant generation.
 */

import type { DetectedProject, CapturedContext, VariantType } from './project.js';

// =============================================================================
// Clipboard and Capture Types
// =============================================================================

/**
 * Payload sent from main process with clipboard text and captured context
 */
export interface ClipboardPayload {
  text: string;
  capturedContext: CapturedContext | null;
  isSourceAppBlocked: boolean; // True if source app doesn't support AppleScript paste
}

/**
 * Empty state reason when no text is captured
 */
export type EmptyStateReason = 'blocked-app' | 'no-selection' | 'empty-clipboard';

/**
 * Payload sent when hotkey is pressed but no text is captured
 */
export interface EmptyStatePayload {
  reason: EmptyStateReason;
  appName: string | null;
  capturedContext: CapturedContext | null;
}

/**
 * Prompt detected event from clipboard watching
 */
export interface PromptDetectedPayload {
  text: string;
  confidence: number;
}

// =============================================================================
// AI Variant Types
// =============================================================================

/**
 * AI variant generation result
 */
export interface AIVariantResult {
  rewrittenPrompt: string;
  keyChanges: string[];
  confidence: number;
  variant: VariantType;
  variantLabel: string;
  isAiGenerated?: boolean;
  aiExplanation?: string;
  needsSetup?: boolean;
  isLoading?: boolean;
}

// =============================================================================
// Analytics Types
// =============================================================================

/**
 * Issue pattern from analytics
 */
export interface IssuePattern {
  category: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  recentCount: number;
  trend: 'improving' | 'stable' | 'worsening';
  lastSeen: Date;
}

/**
 * GOLDEN dimension trend data
 */
export interface GoldenDimensionTrend {
  dimension: string;
  weeklyData: Array<{
    weekStart: string;
    avgScore: number;
    improvement: number;
  }>;
}

/**
 * Consecutive improvement streak
 */
export interface ConsecutiveImprovement {
  startDate: string;
  endDate: string;
  improvementCount: number;
  scoreIncrease: number;
  averageGain: number;
}

/**
 * Category performance metrics
 */
export interface CategoryPerformance {
  category: string;
  count: number;
  averageScore: number;
  bestScore: number;
  trend: 'improving' | 'stable' | 'declining';
  commonWeakness?: string;
}

/**
 * Predicted score based on trends
 */
export interface PredictedScore {
  predictedScore: number;
  confidence: 'high' | 'medium' | 'low';
  trend: number;
}

// =============================================================================
// Ghost Bar Types (moved from ghost-bar-types.ts for consistency)
// =============================================================================

/**
 * Grade for Ghost Bar display
 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Ghost Bar state for floating improvement bar
 */
export interface GhostBarState {
  id: string;
  originalText: string;
  improvedText: string;
  originalGrade: Grade;
  improvedGrade: Grade;
  originalScore: number;
  improvedScore: number;
  variantType: VariantType;
  isBlockedApp: boolean;
  sourceApp: string | null;
}

/**
 * Ghost Bar settings
 */
export interface GhostBarSettings {
  enabled: boolean;
  autoPaste: boolean;
  dismissTimeout: number;
  showOnlyOnImprovement: boolean;
  minimumConfidence: number;
}

/**
 * Ghost Bar show payload
 */
export interface GhostBarShowPayload {
  originalGrade: Grade;
  improvedGrade: Grade;
  originalScore: number;
  improvedScore: number;
  isBlockedApp: boolean;
  sourceApp: string | null;
}

/**
 * Ghost Bar update payload
 */
export interface GhostBarUpdatePayload {
  improvedGrade?: Grade;
  improvedScore?: number;
  variantType?: VariantType;
}

/**
 * Apply result for Ghost Bar
 */
export interface ApplyResult {
  success: boolean;
  fallback?: 'clipboard';
  message?: string;
}
