/**
 * Settings Migration Unit Tests
 * Tests migration from single Claude API key to multi-provider format.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderConfig } from '../providers/types.js';

// Mock electron-store as a Map-backed object
function createMockStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      return data.has(key) ? data.get(key) : defaultValue;
    }),
    set: vi.fn((key: string, value: unknown) => {
      data.set(key, value);
    }),
    _data: data,
  };
}

// Mock provider-manager
vi.mock('../providers/provider-manager.js', () => ({
  migrateFromSingleKey: vi.fn(
    (claudeApiKey: string | undefined, useAiRewrite: boolean | undefined): ProviderConfig[] => {
      if (!claudeApiKey || claudeApiKey.trim() === '') return [];
      return [
        {
          provider: 'claude' as const,
          apiKey: claudeApiKey,
          isEnabled: useAiRewrite ?? false,
          isPrimary: true,
          priority: 1,
        },
      ];
    }
  ),
}));

// Mock electron-store module
vi.mock('electron-store', () => ({
  default: vi.fn(),
}));

import {
  needsMigration,
  migrateToProviders,
  getProvidersFromStore,
  saveProvidersToStore,
} from '../settings-migration.js';

type MockStore = ReturnType<typeof createMockStore>;

describe('Settings Migration', () => {
  describe('needsMigration', () => {
    it('should return true when version < current', () => {
      const store = createMockStore({});
      expect(needsMigration(store as unknown as Parameters<typeof needsMigration>[0])).toBe(true);
    });

    it('should return false when already current', () => {
      const store = createMockStore({ providerMigrationVersion: 1 });
      expect(needsMigration(store as unknown as Parameters<typeof needsMigration>[0])).toBe(false);
    });

    it('should return false when version > current', () => {
      const store = createMockStore({ providerMigrationVersion: 999 });
      expect(needsMigration(store as unknown as Parameters<typeof needsMigration>[0])).toBe(false);
    });
  });

  describe('migrateToProviders', () => {
    it('should migrate old claudeApiKey to providers array', () => {
      const store = createMockStore({
        claudeApiKey: 'sk-ant-test123',
        useAiRewrite: true,
      });

      migrateToProviders(store as unknown as Parameters<typeof migrateToProviders>[0]);

      expect(store.set).toHaveBeenCalledWith('providers', [
        {
          provider: 'claude',
          apiKey: 'sk-ant-test123',
          isEnabled: true,
          isPrimary: true,
          priority: 1,
        },
      ]);
      expect(store.set).toHaveBeenCalledWith('providerMigrationVersion', 1);
    });

    it('should skip if already migrated', () => {
      const store = createMockStore({ providerMigrationVersion: 1 });

      migrateToProviders(store as unknown as Parameters<typeof migrateToProviders>[0]);

      // Should only check migration version, not set providers
      expect(store.set).not.toHaveBeenCalledWith('providers', expect.anything());
    });

    it('should skip if providers already exist', () => {
      const store = createMockStore({
        providers: [
          { provider: 'claude', apiKey: 'key', isEnabled: true, isPrimary: true, priority: 1 },
        ],
      });

      migrateToProviders(store as unknown as Parameters<typeof migrateToProviders>[0]);

      // Should mark migration complete but not overwrite providers
      expect(store.set).toHaveBeenCalledWith('providerMigrationVersion', 1);
    });

    it('should handle no existing API key', () => {
      const store = createMockStore({});

      migrateToProviders(store as unknown as Parameters<typeof migrateToProviders>[0]);

      // Should not set providers (empty result)
      expect(store.set).not.toHaveBeenCalledWith('providers', expect.anything());
      expect(store.set).toHaveBeenCalledWith('providerMigrationVersion', 1);
    });
  });

  describe('getProvidersFromStore', () => {
    it('should return existing providers', () => {
      const providers: ProviderConfig[] = [
        { provider: 'claude', apiKey: 'key1', isEnabled: true, isPrimary: true, priority: 1 },
        { provider: 'openai', apiKey: 'key2', isEnabled: true, isPrimary: false, priority: 2 },
      ];
      const store = createMockStore({ providers });

      const result = getProvidersFromStore(
        store as unknown as Parameters<typeof getProvidersFromStore>[0]
      );
      expect(result).toEqual(providers);
    });

    it('should fall back to migration from old format', () => {
      const store = createMockStore({
        claudeApiKey: 'sk-ant-old',
        useAiRewrite: true,
      });

      const result = getProvidersFromStore(
        store as unknown as Parameters<typeof getProvidersFromStore>[0]
      );
      expect(result).toEqual([
        {
          provider: 'claude',
          apiKey: 'sk-ant-old',
          isEnabled: true,
          isPrimary: true,
          priority: 1,
        },
      ]);
    });

    it('should return empty array when no providers and no old key', () => {
      const store = createMockStore({});

      const result = getProvidersFromStore(
        store as unknown as Parameters<typeof getProvidersFromStore>[0]
      );
      expect(result).toEqual([]);
    });
  });

  describe('saveProvidersToStore', () => {
    it('should save providers and update legacy fields', () => {
      const store = createMockStore({});
      const providers: ProviderConfig[] = [
        { provider: 'claude', apiKey: 'sk-ant-new', isEnabled: true, isPrimary: true, priority: 1 },
      ];

      saveProvidersToStore(
        store as unknown as Parameters<typeof saveProvidersToStore>[0],
        providers
      );

      expect(store.set).toHaveBeenCalledWith('providers', providers);
      expect(store.set).toHaveBeenCalledWith('claudeApiKey', 'sk-ant-new');
      expect(store.set).toHaveBeenCalledWith('useAiRewrite', true);
    });

    it('should not update legacy fields when no claude provider', () => {
      const store = createMockStore({});
      const providers: ProviderConfig[] = [
        { provider: 'openai', apiKey: 'sk-openai', isEnabled: true, isPrimary: true, priority: 1 },
      ];

      saveProvidersToStore(
        store as unknown as Parameters<typeof saveProvidersToStore>[0],
        providers
      );

      expect(store.set).toHaveBeenCalledWith('providers', providers);
      expect(store.set).not.toHaveBeenCalledWith('claudeApiKey', expect.anything());
    });
  });
});
