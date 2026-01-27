/**
 * Provider Handlers Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { ProviderHandlerDeps } from '../provider-handlers.js';
import type { ProviderConfig } from '../../providers/types.js';

// Mock Electron modules
const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

describe('Provider Handlers', () => {
  let deps: ProviderHandlerDeps;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();

    deps = {
      getAIProviders: vi.fn(),
      setAIProviders: vi.fn(),
      getPrimaryProviderConfig: vi.fn(),
      hasAnyAIProvider: vi.fn(),
      validateProviderKey: vi.fn(),
    };

    const { registerProviderHandlers } = await import('../provider-handlers.js');
    registerProviderHandlers(deps);
  });

  const mockProviders: ProviderConfig[] = [
    {
      type: 'claude',
      apiKey: 'sk-ant-test123',
      enabled: true,
      priority: 1,
    },
    {
      type: 'openai',
      apiKey: 'sk-test456',
      enabled: false,
      priority: 2,
    },
  ];

  describe('get-providers', () => {
    it('should return all configured providers', async () => {
      (deps.getAIProviders as Mock).mockReturnValue(mockProviders);

      const handler = mockIpcHandlers.get('get-providers');
      const result = await handler!();

      expect(result).toEqual(mockProviders);
      expect(deps.getAIProviders).toHaveBeenCalled();
    });

    it('should return empty array when no providers', async () => {
      (deps.getAIProviders as Mock).mockReturnValue([]);

      const handler = mockIpcHandlers.get('get-providers');
      const result = await handler!();

      expect(result).toEqual([]);
    });
  });

  describe('set-providers', () => {
    it('should save provider configuration', async () => {
      const handler = mockIpcHandlers.get('set-providers');
      const result = await handler!(null, mockProviders);

      expect(deps.setAIProviders).toHaveBeenCalledWith(mockProviders);
      expect(result).toBe(true);
    });

    it('should handle empty provider array', async () => {
      const handler = mockIpcHandlers.get('set-providers');
      const result = await handler!(null, []);

      expect(deps.setAIProviders).toHaveBeenCalledWith([]);
      expect(result).toBe(true);
    });

    it('should handle single provider', async () => {
      const singleProvider: ProviderConfig[] = [mockProviders[0]];

      const handler = mockIpcHandlers.get('set-providers');
      const result = await handler!(null, singleProvider);

      expect(deps.setAIProviders).toHaveBeenCalledWith(singleProvider);
      expect(result).toBe(true);
    });

    it('should handle multiple providers with different priorities', async () => {
      const multiProviders: ProviderConfig[] = [
        { type: 'claude', apiKey: 'key1', enabled: true, priority: 1 },
        { type: 'openai', apiKey: 'key2', enabled: true, priority: 2 },
        { type: 'gemini', apiKey: 'key3', enabled: true, priority: 3 },
      ];

      const handler = mockIpcHandlers.get('set-providers');
      const result = await handler!(null, multiProviders);

      expect(deps.setAIProviders).toHaveBeenCalledWith(multiProviders);
      expect(result).toBe(true);
    });
  });

  describe('validate-provider-key', () => {
    it('should validate Claude API key successfully', async () => {
      (deps.validateProviderKey as Mock).mockResolvedValue(true);

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'claude', 'sk-ant-test123');

      expect(deps.validateProviderKey).toHaveBeenCalledWith('claude', 'sk-ant-test123');
      expect(result).toEqual({ valid: true, error: null });
    });

    it('should validate OpenAI API key successfully', async () => {
      (deps.validateProviderKey as Mock).mockResolvedValue(true);

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'openai', 'sk-test456');

      expect(deps.validateProviderKey).toHaveBeenCalledWith('openai', 'sk-test456');
      expect(result).toEqual({ valid: true, error: null });
    });

    it('should validate Gemini API key successfully', async () => {
      (deps.validateProviderKey as Mock).mockResolvedValue(true);

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'gemini', 'AIza-test789');

      expect(deps.validateProviderKey).toHaveBeenCalledWith('gemini', 'AIza-test789');
      expect(result).toEqual({ valid: true, error: null });
    });

    it('should return error for invalid API key', async () => {
      (deps.validateProviderKey as Mock).mockResolvedValue(false);

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'claude', 'invalid-key');

      expect(result).toEqual({ valid: false, error: null });
    });

    it('should handle validation error with error message', async () => {
      (deps.validateProviderKey as Mock).mockRejectedValue(new Error('API connection failed'));

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'claude', 'sk-ant-test123');

      expect(result).toEqual({ valid: false, error: 'API connection failed' });
    });

    it('should handle validation error with non-Error object', async () => {
      (deps.validateProviderKey as Mock).mockRejectedValue('String error');

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'openai', 'sk-test456');

      expect(result).toEqual({ valid: false, error: 'Unknown error' });
    });

    it('should handle rate limit error', async () => {
      (deps.validateProviderKey as Mock).mockRejectedValue(new Error('Rate limit exceeded'));

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'claude', 'sk-ant-test123');

      expect(result).toEqual({ valid: false, error: 'Rate limit exceeded' });
    });

    it('should handle network error', async () => {
      (deps.validateProviderKey as Mock).mockRejectedValue(new Error('Network timeout'));

      const handler = mockIpcHandlers.get('validate-provider-key');
      const result = await handler!(null, 'gemini', 'AIza-test789');

      expect(result).toEqual({ valid: false, error: 'Network timeout' });
    });
  });

  describe('get-primary-provider', () => {
    it('should return primary provider configuration', async () => {
      (deps.getPrimaryProviderConfig as Mock).mockReturnValue(mockProviders[0]);

      const handler = mockIpcHandlers.get('get-primary-provider');
      const result = await handler!();

      expect(result).toEqual(mockProviders[0]);
      expect(deps.getPrimaryProviderConfig).toHaveBeenCalled();
    });

    it('should return null when no primary provider', async () => {
      (deps.getPrimaryProviderConfig as Mock).mockReturnValue(null);

      const handler = mockIpcHandlers.get('get-primary-provider');
      const result = await handler!();

      expect(result).toBeNull();
    });

    it('should return provider with lowest priority number', async () => {
      const primaryProvider: ProviderConfig = {
        type: 'claude',
        apiKey: 'sk-ant-primary',
        enabled: true,
        priority: 1,
      };
      (deps.getPrimaryProviderConfig as Mock).mockReturnValue(primaryProvider);

      const handler = mockIpcHandlers.get('get-primary-provider');
      const result = await handler!();

      expect(result).toEqual(primaryProvider);
    });
  });

  describe('has-any-provider', () => {
    it('should return true when providers exist', async () => {
      (deps.hasAnyAIProvider as Mock).mockReturnValue(true);

      const handler = mockIpcHandlers.get('has-any-provider');
      const result = await handler!();

      expect(result).toBe(true);
      expect(deps.hasAnyAIProvider).toHaveBeenCalled();
    });

    it('should return false when no providers', async () => {
      (deps.hasAnyAIProvider as Mock).mockReturnValue(false);

      const handler = mockIpcHandlers.get('has-any-provider');
      const result = await handler!();

      expect(result).toBe(false);
    });

    it('should return false when all providers disabled', async () => {
      (deps.hasAnyAIProvider as Mock).mockReturnValue(false);

      const handler = mockIpcHandlers.get('has-any-provider');
      const result = await handler!();

      expect(result).toBe(false);
    });
  });

  describe('IPC registration', () => {
    it('should register all provider handlers', () => {
      expect(mockIpcHandlers.has('get-providers')).toBe(true);
      expect(mockIpcHandlers.has('set-providers')).toBe(true);
      expect(mockIpcHandlers.has('validate-provider-key')).toBe(true);
      expect(mockIpcHandlers.has('get-primary-provider')).toBe(true);
      expect(mockIpcHandlers.has('has-any-provider')).toBe(true);
    });

    it('should have correct number of handlers', () => {
      expect(mockIpcHandlers.size).toBe(5);
    });
  });
});
