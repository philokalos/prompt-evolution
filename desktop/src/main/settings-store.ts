/**
 * Settings Store & AI Provider Configuration
 * Extracted from index.ts to break circular dependency with learning-engine.ts
 */

import { app } from 'electron';
import Store from 'electron-store';
import {
  getProvidersFromStore,
  saveProvidersToStore,
} from './settings-migration.js';
import type { ProviderConfig } from './providers/types.js';
import { hasAnyProvider } from './providers/provider-manager.js';
import type { UserLanguagePreference } from './i18n.js';

// Settings schema
export interface AppSettings {
  shortcut: string;
  windowBounds: { width: number; height: number };
  alwaysOnTop: boolean;
  hideOnCopy: boolean;
  showNotifications: boolean;
  captureMode: 'auto' | 'selection' | 'clipboard';
  enableProjectPolling: boolean;
  pollingIntervalMs: number;
  claudeApiKey: string;
  useAiRewrite: boolean;
  // Innovative activation methods
  enableClipboardWatch: boolean;
  enableAIContextPopup: boolean;
  autoAnalyzeOnCopy: boolean;
  autoShowWindow: boolean;
  // Manual project override
  manualProjectPath: string;
  // First launch flags
  hasSeenWelcome: boolean;
  hasSeenAccessibilityDialog: boolean;
  // Language preference
  language: UserLanguagePreference;
  // Ghost Bar settings
  ghostBar: {
    enabled: boolean;
    autoPaste: boolean;
    dismissTimeout: number;
    showOnlyOnImprovement: boolean;
    minimumConfidence: number;
  };
}

// Initialize settings store with explicit name to ensure consistency across dev/prod
export const store = new Store<AppSettings>({
  name: 'config',
  cwd: app.getPath('userData').replace(/Electron$/, 'PromptLint'),
  defaults: {
    shortcut: 'CommandOrControl+Shift+P',
    windowBounds: { width: 420, height: 600 },
    alwaysOnTop: true,
    hideOnCopy: false,
    showNotifications: true,
    captureMode: 'auto',
    enableProjectPolling: true,
    pollingIntervalMs: 2000,
    claudeApiKey: '',
    useAiRewrite: false,
    enableClipboardWatch: false,
    enableAIContextPopup: false,
    autoAnalyzeOnCopy: false,
    autoShowWindow: true,
    manualProjectPath: '',
    hasSeenWelcome: false,
    hasSeenAccessibilityDialog: false,
    language: 'auto' as UserLanguagePreference,
    ghostBar: {
      enabled: false,
      autoPaste: true,
      dismissTimeout: 5000,
      showOnlyOnImprovement: true,
      minimumConfidence: 0.15,
    },
  },
});

/**
 * Get AI rewrite settings for use by learning engine
 */
export function getAIRewriteSettings(): { apiKey: string; enabled: boolean } {
  return {
    apiKey: store.get('claudeApiKey') || '',
    enabled: store.get('useAiRewrite') || false,
  };
}

/**
 * Get AI providers configuration
 */
export function getAIProviders(): ProviderConfig[] {
  return getProvidersFromStore(store as unknown as Store<Record<string, unknown>>);
}

/**
 * Set AI providers configuration
 */
export function setAIProviders(providers: ProviderConfig[]): void {
  saveProvidersToStore(store as unknown as Store<Record<string, unknown>>, providers);
}

/**
 * Get the primary provider config
 */
export function getPrimaryProviderConfig(): ProviderConfig | null {
  const providers = getAIProviders();
  const primary = providers.find(p => p.isPrimary && p.isEnabled);
  if (primary) return primary;

  const enabled = providers
    .filter(p => p.isEnabled && p.apiKey && p.apiKey.trim() !== '')
    .sort((a, b) => a.priority - b.priority);
  return enabled.length > 0 ? enabled[0] : null;
}

/**
 * Check if any AI provider is available
 */
export function hasAnyAIProvider(): boolean {
  return hasAnyProvider(getAIProviders());
}
