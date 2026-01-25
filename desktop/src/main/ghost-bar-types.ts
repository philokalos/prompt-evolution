/**
 * Ghost Bar Type Definitions
 *
 * Types used by the Ghost Bar UX feature.
 * Defined in main/ to avoid TypeScript rootDir issues.
 */

// Grade type for prompt quality
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

// Variant type for prompt improvements
export type VariantType = 'ai' | 'balanced' | 'conservative' | 'comprehensive';

// Ghost Bar state for tracking current analysis
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

// User settings for Ghost Bar behavior
export interface GhostBarSettings {
  enabled: boolean;
  autoPaste: boolean;
  dismissTimeout: number;
  showOnlyOnImprovement: boolean;
  minimumConfidence: number;
}

// Payload sent to Ghost Bar renderer
export interface GhostBarShowPayload {
  originalGrade: Grade;
  improvedGrade: Grade;
  originalScore: number;
  improvedScore: number;
  isBlockedApp: boolean;
  sourceApp: string | null;
}

// Payload for updating Ghost Bar state
export interface GhostBarUpdatePayload {
  improvedGrade?: Grade;
  improvedScore?: number;
  variantType?: VariantType;
}

// Result of apply action
export interface ApplyResult {
  success: boolean;
  fallback?: 'clipboard';
  message?: string;
}
