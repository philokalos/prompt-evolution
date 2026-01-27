/**
 * Settings Migration
 * Migrates from single Claude API key to multi-provider format
 */

import Store from 'electron-store';
import type { ProviderConfig } from './providers/types.js';
import { migrateFromSingleKey } from './providers/provider-manager.js';

const MIGRATION_VERSION_KEY = 'providerMigrationVersion';
const SETTINGS_SCHEMA_VERSION_KEY = 'settingsSchemaVersion';
const CURRENT_MIGRATION_VERSION = 1;
const CURRENT_SETTINGS_VERSION = 2;

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

/**
 * Migrate settings to V2 schema
 * - Map 3 clipboard toggles → clipboardMode enum
 * - Detect primary provider from existing API keys
 * - Force captureMode to 'auto'
 * - Simplify ghostBar settings
 */
export function migrateToV2Settings(store: Store<Record<string, unknown>>): void {
  const schemaVersion = store.get(SETTINGS_SCHEMA_VERSION_KEY, 1) as number;

  if (schemaVersion >= CURRENT_SETTINGS_VERSION) {
    console.log('[SettingsMigration] Already migrated to schema version', CURRENT_SETTINGS_VERSION);
    return;
  }

  console.log('[SettingsMigration] Starting settings schema migration from version', schemaVersion);

  // Backup old settings
  const oldSettings = {
    enableClipboardWatch: store.get('enableClipboardWatch'),
    autoAnalyzeOnCopy: store.get('autoAnalyzeOnCopy'),
    hideOnCopy: store.get('hideOnCopy'),
    enableAIContextPopup: store.get('enableAIContextPopup'),
    captureMode: store.get('captureMode'),
    ghostBar: store.get('ghostBar'),
    claudeApiKey: store.get('claudeApiKey'),
    providers: store.get('providers'),
  };

  store.set('settingsBackup_v1', oldSettings);
  console.log('[SettingsMigration] Backed up old settings');

  // Map clipboard toggles to clipboardMode
  const enableClipboardWatch = oldSettings.enableClipboardWatch as boolean | undefined;
  const autoAnalyzeOnCopy = oldSettings.autoAnalyzeOnCopy as boolean | undefined;
  const hideOnCopy = oldSettings.hideOnCopy as boolean | undefined;

  let clipboardMode: 'disabled' | 'manual' | 'auto-visible' | 'auto-hide';
  if (!enableClipboardWatch) {
    clipboardMode = 'disabled';
  } else if (!autoAnalyzeOnCopy) {
    clipboardMode = 'manual';
  } else if (!hideOnCopy) {
    clipboardMode = 'auto-visible';
  } else {
    clipboardMode = 'auto-hide';
  }

  store.set('clipboardMode', clipboardMode);
  console.log('[SettingsMigration] Mapped clipboard toggles to mode:', clipboardMode);

  // Detect primary provider from existing API keys
  const providers = oldSettings.providers as ProviderConfig[] | undefined;
  let aiProvider: 'claude' | 'openai' | 'gemini' = 'claude';

  if (providers && providers.length > 0) {
    // Find first enabled provider with API key
    const enabledProvider = providers.find(p => p.isEnabled && p.apiKey);
    if (enabledProvider) {
      aiProvider = enabledProvider.provider;
    } else {
      // Fallback: find first provider with API key
      const providerWithKey = providers.find(p => p.apiKey);
      if (providerWithKey) {
        aiProvider = providerWithKey.provider;
      }
    }
  } else {
    // Legacy: check old claudeApiKey
    const claudeApiKey = oldSettings.claudeApiKey as string | undefined;
    if (claudeApiKey) {
      aiProvider = 'claude';
    }
  }

  store.set('aiProvider', aiProvider);
  console.log('[SettingsMigration] Detected primary provider:', aiProvider);

  // Force captureMode to 'auto' (hidden from UI)
  store.set('captureMode', 'auto');

  // Simplify ghostBar settings
  const oldGhostBar = oldSettings.ghostBar as {
    enabled?: boolean;
    autoPaste?: boolean;
    dismissTimeout?: number;
    showOnlyOnImprovement?: boolean;
    minimumConfidence?: number;
  } | undefined;

  const newGhostBar = {
    enabled: oldGhostBar?.enabled ?? false,
    showOnlyOnImprovement: oldGhostBar?.showOnlyOnImprovement ?? true,
    minimumConfidence: oldGhostBar?.minimumConfidence ?? 0.15,
  };

  store.set('ghostBar', newGhostBar);
  console.log('[SettingsMigration] Simplified ghostBar settings');

  // Initialize hasCompletedOnboarding
  const hasSeenWelcome = store.get('hasSeenWelcome', false) as boolean;
  store.set('hasCompletedOnboarding', hasSeenWelcome);

  // Mark migration as complete
  store.set(SETTINGS_SCHEMA_VERSION_KEY, CURRENT_SETTINGS_VERSION);
  console.log('[SettingsMigration] Settings schema migration complete to version', CURRENT_SETTINGS_VERSION);
}

/**
 * Run all migrations
 */
export function runAllMigrations(store: Store<Record<string, unknown>>): void {
  migrateToProviders(store);
  migrateToV2Settings(store);
}
