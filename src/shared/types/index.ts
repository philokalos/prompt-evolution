/**
 * Shared Types Index
 * Central export point for all shared types
 */

// Classification types
export type {
  PromptIntent,
  TaskCategory,
  ClassificationResult,
  PromptClassification,
  PromptFeatures,
  MultiLabelClassification,
  SecondaryClassification,
  IntentScoreDetails,
} from './classification.js';

// GOLDEN framework types
export type {
  GOLDENScore,
  GoldenScores,
  Grade,
  GuidelineEvaluation,
  GuidelineScore,
  DetectedAntiPattern,
} from './golden.js';

// Analysis types
export type {
  Issue,
  AnalysisResult,
  AnalysisResultWithContext,
  RewriteResult,
  HistoryRecommendation,
  SessionContext,
  ActiveSessionContext,
  PromptHistory,
  PersonalStats,
  ProgressPoint,
} from './analysis.js';
