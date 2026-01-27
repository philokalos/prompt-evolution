/**
 * Settings Store Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import type { ProviderConfig } from '../providers/types.js';

// Mock electron and electron-store
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockStore = {
  get: mockGet,
  set: mockSet,
};

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test/userData'),
    isPackaged: false,
  },
}));

vi.mock('electron-store', () => ({
  default: vi.fn(function(this: any) {
    Object.assign(this, mockStore);
    return this;
  }),
}));

// Mock settings-migration
const mockGetProvidersFromStore = vi.fn();
const mockSaveProvidersToStore = vi.fn();

vi.mock('../settings-migration.js', () => ({
  getProvidersFromStore: mockGetProvidersFromStore,
  saveProvidersToStore: mockSaveProvidersToStore,
}));

// Mock provider-manager
const mockHasAnyProvider = vi.fn();

vi.mock('../providers/provider-manager.js', () => ({
  hasAnyProvider: mockHasAnyProvider,
}));

describe('Settings Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getAIRewriteSettings', () => {
    it('should return API key and enabled status', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'claudeApiKey') return 'sk-ant-test123';
        if (key === 'useAiRewrite') return true;
        return undefined;
      });

      const { getAIRewriteSettings } = await import('../settings-store.js');
      const result = getAIRewriteSettings();

      expect(result).toEqual({
        apiKey: 'sk-ant-test123',
        enabled: true,
      });
    });

    it('should return empty API key when not set', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'claudeApiKey') return '';
        if (key === 'useAiRewrite') return false;
        return undefined;
      });

      const { getAIRewriteSettings } = await import('../settings-store.js');
      const result = getAIRewriteSettings();

      expect(result).toEqual({
        apiKey: '',
        enabled: false,
      });
    });

    it('should handle null values with fallback', async () => {
      mockGet.mockReturnValue(null);

      const { getAIRewriteSettings } = await import('../settings-store.js');
      const result = getAIRewriteSettings();

      expect(result).toEqual({
        apiKey: '',
        enabled: false,
      });
    });
  });

  describe('getAIProviders', () => {
    it('should return providers from store', async () => {
      const mockProviders: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: 'sk-ant-test',
          isEnabled: true,
          isPrimary: true,
          priority: 1,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(mockProviders);

      const { getAIProviders } = await import('../settings-store.js');
      const result = getAIProviders();

      expect(result).toEqual(mockProviders);
      expect(mockGetProvidersFromStore).toHaveBeenCalled();
    });

    it('should return empty array when no providers', async () => {
      mockGetProvidersFromStore.mockReturnValue([]);

      const { getAIProviders } = await import('../settings-store.js');
      const result = getAIProviders();

      expect(result).toEqual([]);
    });
  });

  describe('setAIProviders', () => {
    it('should save providers to store', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'openai',
          apiKey: 'sk-test',
          isEnabled: true,
          isPrimary: false,
          priority: 2,
        },
      ];

      const { setAIProviders } = await import('../settings-store.js');
      setAIProviders(providers);

      expect(mockSaveProvidersToStore).toHaveBeenCalledWith(mockStore, providers);
    });

    it('should handle empty providers array', async () => {
      const { setAIProviders } = await import('../settings-store.js');
      setAIProviders([]);

      expect(mockSaveProvidersToStore).toHaveBeenCalledWith(mockStore, []);
    });
  });

  describe('getPrimaryProviderConfig', () => {
    it('should return primary enabled provider', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: 'sk-ant-test',
          isEnabled: true,
          isPrimary: true,
          priority: 1,
        },
        {
          provider: 'openai',
          apiKey: 'sk-test',
          isEnabled: true,
          isPrimary: false,
          priority: 2,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);

      const { getPrimaryProviderConfig } = await import('../settings-store.js');
      const result = getPrimaryProviderConfig();

      expect(result).toEqual(providers[0]);
    });

    it('should fallback to highest priority enabled provider when no primary', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'openai',
          apiKey: 'sk-test2',
          isEnabled: true,
          isPrimary: false,
          priority: 2,
        },
        {
          provider: 'claude',
          apiKey: 'sk-ant-test',
          isEnabled: true,
          isPrimary: false,
          priority: 1,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);

      const { getPrimaryProviderConfig } = await import('../settings-store.js');
      const result = getPrimaryProviderConfig();

      expect(result).toEqual(providers[1]); // Priority 1
    });

    it('should return null when no enabled providers', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: 'sk-ant-test',
          isEnabled: false,
          isPrimary: true,
          priority: 1,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);

      const { getPrimaryProviderConfig } = await import('../settings-store.js');
      const result = getPrimaryProviderConfig();

      expect(result).toBeNull();
    });

    it('should return null when empty providers', async () => {
      mockGetProvidersFromStore.mockReturnValue([]);

      const { getPrimaryProviderConfig } = await import('../settings-store.js');
      const result = getPrimaryProviderConfig();

      expect(result).toBeNull();
    });

    it('should skip providers with empty API key', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: '',
          isEnabled: true,
          isPrimary: false,
          priority: 1,
        },
        {
          provider: 'openai',
          apiKey: 'sk-test',
          isEnabled: true,
          isPrimary: false,
          priority: 2,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);

      const { getPrimaryProviderConfig } = await import('../settings-store.js');
      const result = getPrimaryProviderConfig();

      expect(result).toEqual(providers[1]);
    });

    it('should skip providers with whitespace-only API key', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: '   ',
          isEnabled: true,
          isPrimary: false,
          priority: 1,
        },
        {
          provider: 'openai',
          apiKey: 'sk-test',
          isEnabled: true,
          isPrimary: false,
          priority: 2,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);

      const { getPrimaryProviderConfig } = await import('../settings-store.js');
      const result = getPrimaryProviderConfig();

      expect(result).toEqual(providers[1]);
    });
  });

  describe('hasAnyAIProvider', () => {
    it('should return true when providers exist', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: 'sk-ant-test',
          isEnabled: true,
          isPrimary: true,
          priority: 1,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);
      mockHasAnyProvider.mockReturnValue(true);

      const { hasAnyAIProvider } = await import('../settings-store.js');
      const result = hasAnyAIProvider();

      expect(result).toBe(true);
      expect(mockHasAnyProvider).toHaveBeenCalledWith(providers);
    });

    it('should return false when no providers', async () => {
      mockGetProvidersFromStore.mockReturnValue([]);
      mockHasAnyProvider.mockReturnValue(false);

      const { hasAnyAIProvider } = await import('../settings-store.js');
      const result = hasAnyAIProvider();

      expect(result).toBe(false);
    });

    it('should return false when all providers disabled', async () => {
      const providers: ProviderConfig[] = [
        {
          provider: 'claude',
          apiKey: 'sk-ant-test',
          isEnabled: false,
          isPrimary: true,
          priority: 1,
        },
      ];
      mockGetProvidersFromStore.mockReturnValue(providers);
      mockHasAnyProvider.mockReturnValue(false);

      const { hasAnyAIProvider } = await import('../settings-store.js');
      const result = hasAnyAIProvider();

      expect(result).toBe(false);
    });
  });
});
