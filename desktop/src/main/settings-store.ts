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

// Clipboard mode type
export type ClipboardMode = 'disabled' | 'manual' | 'auto-visible' | 'auto-hide';

// AI provider type
export type AIProvider = 'claude' | 'openai' | 'gemini';

// Settings schema
export interface AppSettings {
  shortcut: string;
  windowBounds: { width: number; height: number };
  alwaysOnTop: boolean;
  showNotifications: boolean;
  captureMode: 'auto' | 'selection' | 'clipboard'; // Hidden from UI, forced to 'auto'
  enableProjectPolling: boolean;
  pollingIntervalMs: number;
  claudeApiKey: string; // Legacy, kept for backward compatibility
  useAiRewrite: boolean; // Legacy, kept for backward compatibility
  // Clipboard integration
  clipboardMode: ClipboardMode;
  // AI provider (single selection)
  aiProvider: AIProvider;
  autoShowWindow: boolean;
  // Manual project override
  manualProjectPath: string;
  // First launch flags
  hasSeenWelcome: boolean;
  hasSeenAccessibilityDialog: boolean;
  hasCompletedOnboarding: boolean;
  // Language preference
  language: UserLanguagePreference;
  // Ghost Bar settings (simplified)
  ghostBar: {
    enabled: boolean;
    // Removed: autoPaste (hardcoded false), dismissTimeout (hardcoded 7000)
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
    showNotifications: true,
    captureMode: 'auto', // Hidden from UI, always 'auto'
    enableProjectPolling: true,
    pollingIntervalMs: 2000,
    claudeApiKey: '', // Legacy
    useAiRewrite: false, // Legacy
    clipboardMode: 'disabled' as ClipboardMode,
    aiProvider: 'claude' as AIProvider,
    autoShowWindow: true,
    manualProjectPath: '',
    hasSeenWelcome: false,
    hasSeenAccessibilityDialog: false,
    hasCompletedOnboarding: false,
    language: 'auto' as UserLanguagePreference,
    ghostBar: {
      enabled: false,
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
