/**
 * Settings Migration
 * Migrates from single Claude API key to multi-provider format
 */

import Store from 'electron-store';
import type { ProviderConfig } from './providers/types.js';
import { migrateFromSingleKey } from './providers/provider-manager.js';

interface OldSettings {
  claudeApiKey?: string;
  useAiRewrite?: boolean;
}

interface NewSettings {
  providers?: ProviderConfig[];
  // Keep old fields for backward compatibility during transition
  claudeApiKey?: string;
  useAiRewrite?: boolean;
}

const MIGRATION_VERSION_KEY = 'providerMigrationVersion';
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Check if migration is needed
 */
export function needsMigration(store: Store<Record<string, unknown>>): boolean {
  const migrationVersion = store.get(MIGRATION_VERSION_KEY, 0) as number;
  return migrationVersion < CURRENT_MIGRATION_VERSION;
}

/**
 * Migrate settings from single API key to multi-provider format
 * Preserves backward compatibility with existing settings
 */
export function migrateToProviders(store: Store<Record<string, unknown>>): void {
  const migrationVersion = store.get(MIGRATION_VERSION_KEY, 0) as number;

  if (migrationVersion >= CURRENT_MIGRATION_VERSION) {
    console.log('[SettingsMigration] Already migrated to version', CURRENT_MIGRATION_VERSION);
    return;
  }

  console.log('[SettingsMigration] Starting migration from version', migrationVersion);

  // Check if already has providers configured
  const existingProviders = store.get('providers') as ProviderConfig[] | undefined;
  if (existingProviders && existingProviders.length > 0) {
    console.log('[SettingsMigration] Providers already configured, skipping migration');
    store.set(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION);
    return;
  }

  // Get old settings
  const claudeApiKey = store.get('claudeApiKey') as string | undefined;
  const useAiRewrite = store.get('useAiRewrite') as boolean | undefined;

  // Migrate to new format
  const providers = migrateFromSingleKey(claudeApiKey, useAiRewrite);

  if (providers.length > 0) {
    store.set('providers', providers);
    console.log('[SettingsMigration] Migrated Claude API key to providers array');
  } else {
    console.log('[SettingsMigration] No existing API key to migrate');
  }

  // Mark migration as complete
  store.set(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION);
  console.log('[SettingsMigration] Migration complete to version', CURRENT_MIGRATION_VERSION);
}

/**
 * Get providers from store (handles both old and new format)
 */
export function getProvidersFromStore(store: Store<Record<string, unknown>>): ProviderConfig[] {
  // First check for new format
  const providers = store.get('providers') as ProviderConfig[] | undefined;
  if (providers && providers.length > 0) {
    return providers;
  }

  // Fallback to migration from old format (in case migration wasn't run)
  const claudeApiKey = store.get('claudeApiKey') as string | undefined;
  const useAiRewrite = store.get('useAiRewrite') as boolean | undefined;

  return migrateFromSingleKey(claudeApiKey, useAiRewrite);
}

/**
 * Save providers to store
 */
export function saveProvidersToStore(
  store: Store<Record<string, unknown>>,
  providers: ProviderConfig[]
): void {
  store.set('providers', providers);

  // Also update legacy fields for backward compatibility
  const claudeProvider = providers.find(p => p.provider === 'claude');
  if (claudeProvider) {
    store.set('claudeApiKey', claudeProvider.apiKey);
    store.set('useAiRewrite', claudeProvider.isEnabled);
  }
}
