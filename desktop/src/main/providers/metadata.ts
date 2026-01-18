/**
 * Provider Metadata
 * Display information and defaults for each AI provider
 */

import type { ProviderType } from './types.js';

/**
 * Provider metadata for UI display
 */
export interface ProviderMetadata {
  id: ProviderType;
  displayName: string;
  description: string;
  docsUrl: string;
  keyPrefix: string;
  keyPlaceholder: string;
  defaultModel: string;
  icon?: string;
}

/**
 * Known providers with their metadata
 */
export const PROVIDER_METADATA: Record<ProviderType, ProviderMetadata> = {
  claude: {
    id: 'claude',
    displayName: 'Claude',
    description: 'Anthropic Claude API',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-...',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'OpenAI GPT API',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-4o',
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini',
    description: 'Google Gemini API',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
    keyPlaceholder: 'AIza...',
    defaultModel: 'gemini-2.0-flash',
  },
};

/**
 * Get provider metadata by type
 */
export function getProviderMetadata(provider: ProviderType): ProviderMetadata {
  return PROVIDER_METADATA[provider];
}

/**
 * Get all provider types
 */
export function getAllProviderTypes(): ProviderType[] {
  return Object.keys(PROVIDER_METADATA) as ProviderType[];
}

/**
 * Check if a string looks like a valid API key for a provider
 * (Simple prefix check, not actual validation)
 */
export function hasValidKeyFormat(provider: ProviderType, key: string): boolean {
  if (!key || key.trim() === '') return false;
  const metadata = PROVIDER_METADATA[provider];
  return key.startsWith(metadata.keyPrefix);
}
