/**
 * useInstructionLinter Hook
 *
 * State management + IPC wrapper for instruction file linting.
 * Handles file detection, analysis, history, and CLAUDE.md generation.
 */

import { useState, useCallback } from 'react';

// =============================================================================
// Types (renderer-side, no shared type imports to avoid build issues)
// =============================================================================

interface GoldenScores {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
  total: number;
}

interface IssueLocation {
  lineStart: number;
  lineEnd: number;
  section?: string;
}

interface InstructionIssue {
  severity: string;
  type: string;
  description: string;
  location: IssueLocation;
  suggestion?: string;
  relatedLines?: string[];
}

interface InstructionSuggestion {
  issueIndex: number;
  type: string;
  originalText?: string;
  suggestedText: string;
  description: string;
}

export interface InstructionAnalysisResult {
  filePath: string;
  fileFormat: string;
  overallScore: number;
  grade: string;
  goldenScores: GoldenScores;
  issues: InstructionIssue[];
  suggestions: InstructionSuggestion[];
  sections: Array<{
    heading: string;
    level: number;
    content: string;
    lineStart: number;
    lineEnd: number;
    codeBlocks: string[];
    references: string[];
  }>;
  references: Array<{
    path: string;
    resolvedPath?: string;
    exists: boolean;
    content?: string;
    lineCount?: number;
  }>;
  fileSize: number;
  lineCount: number;
  analyzedAt: string;
}

interface DetectedFile {
  path: string;
  format: string;
  size: number;
  lastModified: string;
}

interface GenerateResult {
  draft: string;
  detectedStack: {
    languages: string[];
    frameworks: string[];
    buildTools: string[];
    testFrameworks: string[];
  };
  confidence: number;
}

// =============================================================================
// Hook
// =============================================================================

export function useInstructionLinter() {
  const [analysis, setAnalysis] = useState<InstructionAnalysisResult | null>(null);
  const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState<GenerateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lintFile = useCallback(async (filePath: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.lintInstructionFile(filePath);
      setAnalysis(result as InstructionAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const detectFiles = useCallback(async (projectPath?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const files = await window.electronAPI.detectInstructionFiles(projectPath);
      setDetectedFiles(files as DetectedFile[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateClaudeMd = useCallback(async (projectPath: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.generateClaudeMd(projectPath);
      setGeneratedDraft(result as GenerateResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveInstructionFile = useCallback(async (filePath: string, content: string) => {
    try {
      const result = await window.electronAPI.saveInstructionFile(filePath, content);
      return result as { success: boolean; message?: string };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return { success: false, message: String(err) };
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setDetectedFiles([]);
    setGeneratedDraft(null);
    setError(null);
  }, []);

  return {
    // State
    analysis,
    detectedFiles,
    generatedDraft,
    isLoading,
    error,
    // Actions
    lintFile,
    detectFiles,
    generateClaudeMd,
    saveInstructionFile,
    clearAnalysis,
  };
}
