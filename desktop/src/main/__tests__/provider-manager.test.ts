/**
 * Provider Manager Unit Tests
 * Tests multi-provider orchestration with fallback support.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  ProviderConfig,
  AIProvider,
  RewriteRequest,
  ProviderRewriteResult,
} from '../providers/types.js';

// Create mock providers with vi.hoisted
const mockProviders = vi.hoisted(() => {
  const createMockProvider = (name: 'claude' | 'openai' | 'gemini'): AIProvider => ({
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    rewritePrompt: vi.fn(),
    validateKey: vi.fn(),
  });

  return {
    claude: createMockProvider('claude'),
    openai: createMockProvider('openai'),
    gemini: createMockProvider('gemini'),
  };
});

vi.mock('../providers/claude-provider.js', () => ({
  claudeProvider: mockProviders.claude,
}));

vi.mock('../providers/openai-provider.js', () => ({
  openaiProvider: mockProviders.openai,
}));

vi.mock('../providers/gemini-provider.js', () => ({
  geminiProvider: mockProviders.gemini,
}));

import {
  getProvider,
  getAvailableProviders,
  getEnabledProviders,
  getPrimaryProvider,
  hasAnyProvider,
  rewriteWithFallback,
  validateProviderKey,
  createDefaultProviderConfig,
  migrateFromSingleKey,
} from '../providers/provider-manager.js';

function makeConfig(
  provider: 'claude' | 'openai' | 'gemini',
  overrides: Partial<ProviderConfig> = {}
): ProviderConfig {
  return {
    provider,
    apiKey: `key-${provider}`,
    isEnabled: true,
    isPrimary: false,
    priority: 1,
    ...overrides,
  };
}

const mockRequest: RewriteRequest = {
  originalPrompt: 'Fix this bug',
  goldenScores: { goal: 0.5, output: 0.3, limits: 0.2, data: 0.1, evaluation: 0.4, next: 0.2 },
  issues: [{ severity: 'high', category: 'goal', message: 'Vague goal', suggestion: 'Be specific' }],
};

const successResult: ProviderRewriteResult = {
  success: true,
  rewrittenPrompt: 'Please analyze and fix the authentication bug in login.ts',
  explanation: 'Added specificity',
  improvements: ['Specified file', 'Added context'],
};

const failResult: ProviderRewriteResult = {
  success: false,
  error: 'API rate limited',
};

describe('Provider Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should return claude provider', () => {
      expect(getProvider('claude')).toBe(mockProviders.claude);
    });

    it('should return openai provider', () => {
      expect(getProvider('openai')).toBe(mockProviders.openai);
    });

    it('should return gemini provider', () => {
      expect(getProvider('gemini')).toBe(mockProviders.gemini);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all 3 provider types', () => {
      const result = getAvailableProviders();
      expect(result).toEqual(expect.arrayContaining(['claude', 'openai', 'gemini']));
      expect(result).toHaveLength(3);
    });
  });

  describe('getEnabledProviders', () => {
    it('should filter out disabled providers', () => {
      const configs = [
        makeConfig('claude', { isEnabled: true, priority: 2 }),
        makeConfig('openai', { isEnabled: false, priority: 1 }),
        makeConfig('gemini', { isEnabled: true, priority: 3 }),
      ];

      const result = getEnabledProviders(configs);
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('claude');
      expect(result[1].provider).toBe('gemini');
    });

    it('should filter out providers with empty API keys', () => {
      const configs = [
        makeConfig('claude', { apiKey: '', isEnabled: true }),
        makeConfig('openai', { apiKey: 'valid-key', isEnabled: true }),
      ];

      const result = getEnabledProviders(configs);
      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('openai');
    });

    it('should sort by priority ascending', () => {
      const configs = [
        makeConfig('gemini', { priority: 3 }),
        makeConfig('claude', { priority: 1 }),
        makeConfig('openai', { priority: 2 }),
      ];

      const result = getEnabledProviders(configs);
      expect(result[0].provider).toBe('claude');
      expect(result[1].provider).toBe('openai');
      expect(result[2].provider).toBe('gemini');
    });
  });

  describe('getPrimaryProvider', () => {
    it('should find provider marked as primary', () => {
      const configs = [
        makeConfig('claude', { isPrimary: false }),
        makeConfig('openai', { isPrimary: true }),
      ];

      const result = getPrimaryProvider(configs);
      expect(result?.provider).toBe('openai');
    });

    it('should fall back to first enabled by priority', () => {
      const configs = [
        makeConfig('claude', { isPrimary: false, priority: 2 }),
        makeConfig('openai', { isPrimary: false, priority: 1 }),
      ];

      const result = getPrimaryProvider(configs);
      expect(result?.provider).toBe('openai');
    });

    it('should return null when no providers enabled', () => {
      const configs = [makeConfig('claude', { isEnabled: false })];
      expect(getPrimaryProvider(configs)).toBeNull();
    });
  });

  describe('hasAnyProvider', () => {
    it('should return true when enabled providers exist', () => {
      expect(hasAnyProvider([makeConfig('claude')])).toBe(true);
    });

    it('should return false when no enabled providers', () => {
      expect(hasAnyProvider([makeConfig('claude', { isEnabled: false })])).toBe(false);
    });

    it('should return false for empty configs', () => {
      expect(hasAnyProvider([])).toBe(false);
    });
  });

  describe('rewriteWithFallback', () => {
    it('should succeed with first provider', async () => {
      vi.mocked(mockProviders.claude.rewritePrompt).mockResolvedValue(successResult);

      const configs = [makeConfig('claude', { isPrimary: true })];
      const result = await rewriteWithFallback(mockRequest, configs);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
      expect(result.wasFallback).toBe(false);
      expect(result.rewrittenPrompt).toBe(successResult.rewrittenPrompt);
    });

    it('should fallback to next provider on failure', async () => {
      vi.mocked(mockProviders.claude.rewritePrompt).mockResolvedValue(failResult);
      vi.mocked(mockProviders.openai.rewritePrompt).mockResolvedValue(successResult);

      const configs = [
        makeConfig('claude', { priority: 1 }),
        makeConfig('openai', { priority: 2 }),
      ];
      const result = await rewriteWithFallback(mockRequest, configs);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.wasFallback).toBe(true);
    });

    it('should fallback on thrown error', async () => {
      vi.mocked(mockProviders.claude.rewritePrompt).mockRejectedValue(new Error('Network error'));
      vi.mocked(mockProviders.openai.rewritePrompt).mockResolvedValue(successResult);

      const configs = [
        makeConfig('claude', { priority: 1 }),
        makeConfig('openai', { priority: 2 }),
      ];
      const result = await rewriteWithFallback(mockRequest, configs);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.wasFallback).toBe(true);
    });

    it('should return error when no providers enabled', async () => {
      const result = await rewriteWithFallback(mockRequest, []);

      expect(result.success).toBe(false);
      expect(result.wasFallback).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should set wasFallback flag when fallback occurs', async () => {
      vi.mocked(mockProviders.claude.rewritePrompt).mockResolvedValue(failResult);
      vi.mocked(mockProviders.openai.rewritePrompt).mockResolvedValue(successResult);

      const configs = [
        makeConfig('claude', { priority: 1 }),
        makeConfig('openai', { priority: 2 }),
      ];
      const result = await rewriteWithFallback(mockRequest, configs);

      expect(result.wasFallback).toBe(true);
      expect(result.fallbackReason).toBe('API rate limited');
    });

    it('should return error when all providers fail', async () => {
      vi.mocked(mockProviders.claude.rewritePrompt).mockResolvedValue(failResult);
      vi.mocked(mockProviders.openai.rewritePrompt).mockResolvedValue(failResult);

      const configs = [
        makeConfig('claude', { priority: 1 }),
        makeConfig('openai', { priority: 2 }),
      ];
      const result = await rewriteWithFallback(mockRequest, configs);

      expect(result.success).toBe(false);
    });
  });

  describe('validateProviderKey', () => {
    it('should delegate to correct provider', async () => {
      vi.mocked(mockProviders.openai.validateKey).mockResolvedValue(true);

      const result = await validateProviderKey('openai', 'sk-test');

      expect(mockProviders.openai.validateKey).toHaveBeenCalledWith('sk-test');
      expect(result).toBe(true);
    });
  });

  describe('createDefaultProviderConfig', () => {
    it('should create config with defaults', () => {
      const config = createDefaultProviderConfig('claude');

      expect(config.provider).toBe('claude');
      expect(config.apiKey).toBe('');
      expect(config.isEnabled).toBe(false);
      expect(config.isPrimary).toBe(false);
      expect(config.priority).toBe(1);
    });

    it('should create config with provided values', () => {
      const config = createDefaultProviderConfig('openai', 'sk-key', true, 2);

      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('sk-key');
      expect(config.isEnabled).toBe(true);
      expect(config.isPrimary).toBe(true);
      expect(config.priority).toBe(2);
    });
  });

  describe('migrateFromSingleKey', () => {
    it('should migrate existing key', () => {
      const result = migrateFromSingleKey('sk-ant-key', true);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        provider: 'claude',
        apiKey: 'sk-ant-key',
        isEnabled: true,
        isPrimary: true,
        priority: 1,
      });
    });

    it('should handle empty key', () => {
      const result = migrateFromSingleKey('', undefined);
      expect(result).toEqual([]);
    });

    it('should handle undefined key', () => {
      const result = migrateFromSingleKey(undefined, undefined);
      expect(result).toEqual([]);
    });

    it('should default isEnabled to false when useAiRewrite undefined', () => {
      const result = migrateFromSingleKey('sk-ant-key', undefined);
      expect(result[0].isEnabled).toBe(false);
    });
  });
});
