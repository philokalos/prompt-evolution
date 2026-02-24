/**
 * Instruction Linter Types
 * Types for CLAUDE.md/.cursorrules/copilot-instructions analysis.
 */

import type { Grade } from './analysis.js';
import type { GoldenScores } from '../../../../src/shared/types/index.js';

// =============================================================================
// Enums
// =============================================================================

export type InstructionFileFormat =
  | 'claude-md'
  | 'cursorrules'
  | 'copilot-instructions';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IssueType =
  | 'duplicate'
  | 'conflict'
  | 'missing'
  | 'vague'
  | 'security'
  | 'excessive';

export type SuggestionType =
  | 'merge'
  | 'resolve'
  | 'add-section'
  | 'specify'
  | 'remove'
  | 'split';

// =============================================================================
// Core Entities
// =============================================================================

export interface IssueLocation {
  lineStart: number;
  lineEnd: number;
  section?: string;
}

export interface InstructionIssue {
  severity: IssueSeverity;
  type: IssueType;
  description: string;
  location: IssueLocation;
  suggestion?: string;
  relatedLines?: string[];
}

export interface InstructionSuggestion {
  issueIndex: number;
  type: SuggestionType;
  originalText?: string;
  suggestedText: string;
  description: string;
}

export interface MarkdownSection {
  heading: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
  codeBlocks: string[];
  references: string[];
}

export interface ResolvedReference {
  path: string;
  resolvedPath?: string;
  exists: boolean;
  content?: string;
  lineCount?: number;
}

// =============================================================================
// Analysis Result
// =============================================================================

export interface InstructionAnalysis {
  id?: number;
  filePath: string;
  fileFormat: InstructionFileFormat;
  overallScore: number;
  grade: Grade;
  goldenScores: GoldenScores;
  issues: InstructionIssue[];
  suggestions: InstructionSuggestion[];
  sections: MarkdownSection[];
  references: ResolvedReference[];
  fileSize: number;
  lineCount: number;
  analyzedAt: string;
}

// =============================================================================
// Top Fix (Phase 1)
// =============================================================================

export interface TopFix {
  dimension: string;
  scoreDelta: number;
  issueDescription: string;
  beforeSnippet: string;
  afterSnippet: string;
  totalIssueCount: number;
}

// =============================================================================
// IPC Request/Response Types
// =============================================================================

export interface CopyAndSwitchRequest {
  text: string;
  sourceApp: string;
}

export interface CopyAndSwitchResult {
  success: boolean;
  copiedToClipboard: boolean;
  appSwitched: boolean;
  message?: string;
}

export interface LintInstructionRequest {
  filePath: string;
}

export interface DetectInstructionRequest {
  projectPath?: string;
}

export interface DetectedInstructionFile {
  path: string;
  format: InstructionFileFormat;
  size: number;
  lastModified: string;
}

export interface InstructionHistoryRequest {
  filePath?: string;
  limit?: number;
}

export interface InstructionHistoryEntry {
  id: number;
  filePath: string;
  fileFormat: InstructionFileFormat;
  overallScore: number;
  grade: Grade;
  issueCount: number;
  analyzedAt: string;
}

export interface GenerateClaudeMdRequest {
  projectPath: string;
}

export interface GenerateClaudeMdResponse {
  draft: string;
  detectedStack: {
    languages: string[];
    frameworks: string[];
    buildTools: string[];
    testFrameworks: string[];
  };
  confidence: number;
}

export interface SaveInstructionRequest {
  filePath: string;
  content: string;
  backup?: boolean;
}

export interface SaveInstructionResult {
  success: boolean;
  backupPath?: string;
  message?: string;
}
