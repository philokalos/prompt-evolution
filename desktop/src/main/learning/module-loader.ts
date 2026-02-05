/**
 * Analysis Module Loader
 * Loads CJS-bundled analysis modules for Electron compatibility
 *
 * Extracted from learning-engine.ts to separate module loading concerns
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GOLDEN score structure
 */
export interface GOLDENScore {
  goal: number;
  output: number;
  limits: number;
  data: number;
  evaluation: number;
  next: number;
  total: number;
}

/**
 * Detected anti-pattern structure
 */
export interface DetectedAntiPattern {
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
  fix: string;
}

/**
 * Guideline evaluation result
 */
export interface GuidelineEvaluation {
  overallScore: number;
  guidelineScores: Array<{
    guideline: string;
    name: string;
    description: string;
    score: number;
    weight: number;
    evidence: string[];
    suggestion: string;
  }>;
  goldenScore: GOLDENScore;
  antiPatterns: DetectedAntiPattern[];
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Prompt classification result
 */
export interface PromptClassification {
  intent: string;
  category: string;
  confidence: number;
}

/**
 * Type for the evaluation function
 */
export type EvaluatePromptFn = (text: string) => GuidelineEvaluation;

/**
 * Type for the classification function
 */
export type ClassifyPromptFn = (text: string) => PromptClassification;

/**
 * Get path to analysis bundles
 */
function getAnalysisPaths(): { analysisPath: string; analysisBundlePath: string; classifierBundlePath: string } {
  const isDev = !app.isPackaged;
  const analysisPath = isDev
    ? path.join(__dirname, '../../analysis')
    : path.join(process.resourcesPath, 'analysis');

  return {
    analysisPath,
    analysisBundlePath: path.join(analysisPath, 'analysis-bundle.cjs'),
    classifierBundlePath: path.join(analysisPath, 'classifier-bundle.cjs'),
  };
}

/**
 * Loaded modules cache
 */
let evaluatePromptAgainstGuidelines: EvaluatePromptFn | null = null;
let classifyPrompt: ClassifyPromptFn | null = null;

/**
 * Get the evaluation function if loaded
 */
export function getEvaluator(): EvaluatePromptFn | null {
  return evaluatePromptAgainstGuidelines;
}

/**
 * Get the classifier function if loaded
 */
export function getClassifier(): ClassifyPromptFn | null {
  return classifyPrompt;
}

/**
 * Check if modules are loaded
 */
export function areModulesLoaded(): boolean {
  return evaluatePromptAgainstGuidelines !== null;
}

/**
 * Load analysis modules from CJS bundle
 * Uses require() for CJS compatibility in packaged Electron apps
 */
export async function loadAnalysisModules(): Promise<boolean> {
  // Skip if already loaded
  if (evaluatePromptAgainstGuidelines) {
    return true;
  }

  const { analysisBundlePath, classifierBundlePath } = getAnalysisPaths();

  try {
    // Check if bundle exists
    const fs = await import('fs');
    if (!fs.existsSync(analysisBundlePath)) {
      console.error('[ModuleLoader] Analysis bundle not found at:', analysisBundlePath);
      return false;
    }

    // Use createRequire to load CJS modules from ESM context
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    // Load the bundled analysis module (CJS)
    const analysisModule = require(analysisBundlePath);
    evaluatePromptAgainstGuidelines = analysisModule.evaluatePromptAgainstGuidelines;

    // Load classifier if available
    if (fs.existsSync(classifierBundlePath)) {
      const classifierModule = require(classifierBundlePath);
      classifyPrompt = classifierModule.classifyPrompt;
    }

    console.log('[ModuleLoader] Analysis modules loaded successfully from CJS bundle');
    return true;
  } catch (error) {
    console.error('[ModuleLoader] Failed to load analysis modules:', error);
    return false;
  }
}

/**
 * Reset loaded modules (for testing)
 */
export function resetModules(): void {
  evaluatePromptAgainstGuidelines = null;
  classifyPrompt = null;
}
