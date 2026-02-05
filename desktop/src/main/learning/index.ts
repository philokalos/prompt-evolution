/**
 * Learning Module Barrel Export
 * Re-exports all learning engine functionality.
 */

// Module loader
export {
  loadAnalysisModules,
  getEvaluator,
  getClassifier,
  areModulesLoaded,
  resetModules,
  type GOLDENScore,
  type DetectedAntiPattern,
  type GuidelineEvaluation,
  type PromptClassification,
  type EvaluatePromptFn,
  type ClassifyPromptFn,
} from './module-loader.js';

// Tips generator
export {
  generatePersonalTips,
  getGoldenDimensionsByScore,
  getDimensionsNeedingImprovement,
} from './tips-generator.js';
