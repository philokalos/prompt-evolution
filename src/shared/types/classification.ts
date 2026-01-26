/**
 * Classification Types
 * Shared types for prompt intent and task category classification
 */

/**
 * Prompt intent types
 */
export type PromptIntent =
  | 'command' // Direct instructions: "만들어줘", "create"
  | 'question' // Questions: "왜", "how"
  | 'instruction' // Detailed instructions with context
  | 'feedback' // Response to AI output: "좋아", "아니"
  | 'context' // Providing background information
  | 'clarification' // Asking for clarification
  | 'unknown';

/**
 * Task category types
 */
export type TaskCategory =
  | 'code-generation' // Creating new code
  | 'code-review' // Reviewing existing code
  | 'bug-fix' // Fixing bugs
  | 'refactoring' // Improving code structure
  | 'explanation' // Explaining concepts
  | 'documentation' // Writing docs
  | 'testing' // Writing tests
  | 'architecture' // System design
  | 'deployment' // DevOps tasks
  | 'data-analysis' // Data work
  | 'general' // General tasks
  | 'unknown';

/**
 * Secondary classification for multi-label support
 */
export interface SecondaryClassification {
  category: TaskCategory;
  confidence: number;
}

/**
 * Multi-label classification result
 */
export interface MultiLabelClassification {
  primary: { category: TaskCategory; confidence: number };
  secondary: SecondaryClassification[];
  isMultiIntent: boolean; // true if top-2 confidence gap < 0.15
}

/**
 * Intent score details for debugging/analysis
 */
export interface IntentScoreDetails {
  base: number; // Base keyword matching score
  position: number; // Position weighting bonus (front 25% = x1.5)
  negation: number; // Negation context penalty
  cooccurrence: number; // Keyword combination bonus
  total: number; // Final score
}

/**
 * Classification result
 */
export interface ClassificationResult {
  intent: PromptIntent;
  intentConfidence: number;
  taskCategory: TaskCategory;
  categoryConfidence: number;
  matchedKeywords: string[];
  features: PromptFeatures;
  // Multi-label classification (optional for backward compatibility)
  multiLabel?: MultiLabelClassification;
  // Score details for debugging (optional)
  intentScoreDetails?: Record<string, IntentScoreDetails>;
}

/**
 * Type alias for backward compatibility
 */
export type PromptClassification = ClassificationResult;

/**
 * Extracted prompt features
 */
export interface PromptFeatures {
  length: number;
  wordCount: number;
  hasCodeBlock: boolean;
  hasUrl: boolean;
  hasFilePath: boolean;
  hasQuestionMark: boolean;
  hasExclamationMark: boolean;
  languageHint: 'ko' | 'en' | 'mixed';
  complexity: 'simple' | 'moderate' | 'complex';
}
