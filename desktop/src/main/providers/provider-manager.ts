/**
 * Provider Manager
 * Manages multiple AI providers with fallback support
 */

import type {
  ProviderType,
  ProviderConfig,
  AIProvider,
  RewriteRequest,
  RewriteResultWithProvider,
} from './types.js';
import { claudeProvider } from './claude-provider.js';
import { openaiProvider } from './openai-provider.js';
import { geminiProvider } from './gemini-provider.js';

/**
 * Map of provider instances
 */
const PROVIDERS: Record<ProviderType, AIProvider> = {
  claude: claudeProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

/**
 * Get provider instance by type
 */
export function getProvider(type: ProviderType): AIProvider {
  return PROVIDERS[type];
}

/**
 * Get all available provider types
 */
export function getAvailableProviders(): ProviderType[] {
  return Object.keys(PROVIDERS) as ProviderType[];
}

/**
 * Sort provider configs by priority (ascending)
 */
function sortByPriority(configs: ProviderConfig[]): ProviderConfig[] {
  return [...configs].sort((a, b) => a.priority - b.priority);
}

/**
 * Filter enabled providers
 */
function filterEnabled(configs: ProviderConfig[]): ProviderConfig[] {
  return configs.filter((c) => c.isEnabled && c.apiKey && c.apiKey.trim() !== '');
}

/**
 * Get enabled providers sorted by priority
 */
export function getEnabledProviders(configs: ProviderConfig[]): ProviderConfig[] {
  return sortByPriority(filterEnabled(configs));
}

/**
 * Get the primary provider from configs
 */
export function getPrimaryProvider(configs: ProviderConfig[]): ProviderConfig | null {
  const primary = configs.find((c) => c.isPrimary && c.isEnabled);
  if (primary) return primary;

  // Fallback to first enabled provider
  const enabled = getEnabledProviders(configs);
  return enabled.length > 0 ? enabled[0] : null;
}

/**
 * Check if any AI provider is available
 */
export function hasAnyProvider(configs: ProviderConfig[]): boolean {
  return getEnabledProviders(configs).length > 0;
}

/**
 * Rewrite prompt with fallback support
 * Tries providers in priority order, falls back to next on failure
 */
export async function rewriteWithFallback(
  request: RewriteRequest,
  configs: ProviderConfig[],
  maxRetries: number = 2
): Promise<RewriteResultWithProvider> {
  const enabledProviders = getEnabledProviders(configs);

  if (enabledProviders.length === 0) {
    return {
      success: false,
      error: '활성화된 AI 프로바이더가 없습니다. 설정에서 API 키를 입력해주세요.',
      provider: 'claude', // Default for error case
      wasFallback: false,
    };
  }

  let lastError: string | undefined;
  let attemptCount = 0;

  for (const config of enabledProviders) {
    if (attemptCount >= maxRetries) break;

    const provider = getProvider(config.provider);
    const modelId = config.modelId;

    try {
      console.log(`[ProviderManager] Trying ${config.provider}...`);
      const result = await provider.rewritePrompt(request, config.apiKey, modelId);

      if (result.success) {
        const wasFallback = attemptCount > 0;
        console.log(`[ProviderManager] Success with ${config.provider}${wasFallback ? ' (fallback)' : ''}`);

        return {
          ...result,
          provider: config.provider,
          wasFallback,
          fallbackReason: wasFallback ? lastError : undefined,
        };
      }

      // Provider returned error but didn't throw
      lastError = result.error || 'Unknown error';
      console.warn(`[ProviderManager] ${config.provider} returned error:`, lastError);
      attemptCount++;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[ProviderManager] ${config.provider} threw error:`, lastError);
      attemptCount++;
    }
  }

  // All providers failed
  return {
    success: false,
    error: lastError || '모든 AI 프로바이더가 실패했습니다.',
    provider: enabledProviders[0]?.provider || 'claude',
    wasFallback: attemptCount > 1,
    fallbackReason: attemptCount > 1 ? '모든 프로바이더 시도 후 실패' : undefined,
  };
}

/**
 * Validate a specific provider's API key
 */
export async function validateProviderKey(
  providerType: ProviderType,
  apiKey: string
): Promise<boolean> {
  const provider = getProvider(providerType);
  return provider.validateKey(apiKey);
}

/**
 * Create a default provider config
 */
export function createDefaultProviderConfig(
  type: ProviderType,
  apiKey: string = '',
  isPrimary: boolean = false,
  priority: number = 1
): ProviderConfig {
  return {
    provider: type,
    apiKey,
    isEnabled: apiKey.trim() !== '',
    isPrimary,
    priority,
  };
}

/**
 * Migrate old single-key format to multi-provider format
 */
export function migrateFromSingleKey(
  claudeApiKey: string | undefined,
  useAiRewrite: boolean | undefined
): ProviderConfig[] {
  if (!claudeApiKey || claudeApiKey.trim() === '') {
    return [];
  }

  return [
    {
      provider: 'claude',
      apiKey: claudeApiKey,
      isEnabled: useAiRewrite ?? false,
      isPrimary: true,
      priority: 1,
    },
  ];
}
