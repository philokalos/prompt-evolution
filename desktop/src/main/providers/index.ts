/**
 * Multi-Provider AI API
 * Exports all provider-related types, metadata, and implementations
 */

// Types
export type {
  ProviderType,
  ProviderConfig,
  AIProvider,
  RewriteRequest,
  SessionContext,
  ProviderRewriteResult,
  RewriteResultWithProvider,
} from './types.js';

// Metadata
export {
  PROVIDER_METADATA,
  getProviderMetadata,
  getAllProviderTypes,
  hasValidKeyFormat,
} from './metadata.js';
export type { ProviderMetadata } from './metadata.js';

// Provider implementations
export { ClaudeProvider, claudeProvider } from './claude-provider.js';
export { OpenAIProvider, openaiProvider } from './openai-provider.js';
export { GeminiProvider, geminiProvider } from './gemini-provider.js';

// Shared prompts
export { REWRITE_SYSTEM_PROMPT, buildUserMessage } from './shared-prompts.js';

// Provider manager
export {
  getProvider,
  getAvailableProviders,
  getEnabledProviders,
  getPrimaryProvider,
  hasAnyProvider,
  rewriteWithFallback,
  validateProviderKey,
  createDefaultProviderConfig,
  migrateFromSingleKey,
} from './provider-manager.js';
