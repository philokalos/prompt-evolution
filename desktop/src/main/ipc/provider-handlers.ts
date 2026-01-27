/**
 * IPC Handlers: AI Provider Configuration
 */

import { ipcMain } from 'electron';
import type { ProviderConfig } from '../providers/types.js';

export interface ProviderHandlerDeps {
  getAIProviders: () => ProviderConfig[];
  setAIProviders: (providers: ProviderConfig[]) => void;
  getPrimaryProviderConfig: () => ProviderConfig | null;
  hasAnyAIProvider: () => boolean;
  validateProviderKey: (providerType: 'claude' | 'openai' | 'gemini', apiKey: string) => Promise<boolean>;
}

export function registerProviderHandlers(deps: ProviderHandlerDeps): void {
  const {
    getAIProviders, setAIProviders, getPrimaryProviderConfig,
    hasAnyAIProvider, validateProviderKey,
  } = deps;

  ipcMain.handle('get-providers', () => {
    return getAIProviders();
  });

  ipcMain.handle('set-providers', (_event, providers: ProviderConfig[]) => {
    setAIProviders(providers);
    return true;
  });

  ipcMain.handle('validate-provider-key', async (_event, providerType: string, apiKey: string) => {
    try {
      const valid = await validateProviderKey(providerType as 'claude' | 'openai' | 'gemini', apiKey);
      return { valid, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: message };
    }
  });

  ipcMain.handle('get-primary-provider', () => {
    return getPrimaryProviderConfig();
  });

  ipcMain.handle('has-any-provider', () => {
    return hasAnyAIProvider();
  });
}
