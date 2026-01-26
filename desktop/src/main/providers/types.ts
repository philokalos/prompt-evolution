/**
 * Multi-Provider AI API Types
 * Type definitions for multi-provider support
 */

// ─────────────────────────────────────────────────────────────────────────────
// Provider Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported AI providers
 */
export type ProviderType = 'claude' | 'openai' | 'gemini';

/**
 * Provider configuration stored in settings
 */
export interface ProviderConfig {
  /** Provider identifier */
  provider: ProviderType;

  /** API key (stored in electron-store) */
  apiKey: string;

  /** Whether this provider is enabled */
  isEnabled: boolean;

  /** Whether this is the primary provider */
  isPrimary: boolean;

  /** Fallback priority (1 = highest) */
  priority: number;

  /** Optional display name for UI */
  displayName?: string;

  /** Optional model ID override */
  modelId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Common interface for all AI providers
 * Each provider adapter must implement this interface
 */
export interface AIProvider {
  /** Provider name */
  readonly name: ProviderType;

  /** Display name for UI */
  readonly displayName: string;

  /**
   * Rewrite a prompt using the AI model
   * @param request The rewrite request
   * @param apiKey The API key to use
   * @param modelId Optional model ID override
   * @returns The rewrite result
   */
  rewritePrompt(
    request: RewriteRequest,
    apiKey: string,
    modelId?: string
  ): Promise<ProviderRewriteResult>;

  /**
   * Validate the API key
   * @param apiKey The API key to validate
   * @returns True if valid, false otherwise
   */
  validateKey(apiKey: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request for prompt rewriting
 * (Compatible with existing RewriteRequest in claude-api.ts)
 */
export interface RewriteRequest {
  originalPrompt: string;
  goldenScores: {
    goal: number;
    output: number;
    limits: number;
    data: number;
    evaluation: number;
    next: number;
  };
  issues: Array<{
    severity: string;
    category: string;
    message: string;
    suggestion?: string;
  }>;
  sessionContext?: SessionContext;
}

/**
 * Session context for prompt rewriting
 */
export interface SessionContext {
  projectPath?: string;
  projectName?: string;
  techStack?: string[];
  currentTask?: string;
  recentFiles?: string[];
  recentTools?: string[];
  gitBranch?: string;
  lastExchange?: {
    userMessage: string;
    assistantSummary: string;
    assistantTools: string[];
    assistantFiles: string[];
  };
}

/**
 * Result from provider rewrite
 */
export interface ProviderRewriteResult {
  success: boolean;
  rewrittenPrompt?: string;
  explanation?: string;
  improvements?: string[];
  error?: string;
}

/**
 * Extended result with provider metadata
 * (For use in UI and logging)
 */
export interface RewriteResultWithProvider extends ProviderRewriteResult {
  /** Provider that generated this result */
  provider: ProviderType;

  /** Whether fallback occurred */
  wasFallback: boolean;

  /** Reason for fallback (if applicable) */
  fallbackReason?: string;
}
