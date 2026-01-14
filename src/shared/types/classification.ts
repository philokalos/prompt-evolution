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
 * Classification result
 */
export interface ClassificationResult {
  intent: PromptIntent;
  intentConfidence: number;
  taskCategory: TaskCategory;
  categoryConfidence: number;
  matchedKeywords: string[];
  features: PromptFeatures;
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
