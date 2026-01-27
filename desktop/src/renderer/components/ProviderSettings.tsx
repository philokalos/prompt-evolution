import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Eye, EyeOff, ExternalLink, AlertCircle } from 'lucide-react';

/**
 * Provider configuration type (mirrors main process type)
 */
interface ProviderConfig {
  provider: 'claude' | 'openai' | 'gemini';
  apiKey: string;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number;
  displayName?: string;
  modelId?: string;
}

/**
 * Provider metadata for display (non-translatable data only)
 */
const PROVIDER_INFO: Record<string, { docsUrl: string; keyPrefix: string }> = {
  claude: {
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
  },
  openai: {
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
  },
  gemini: {
    docsUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
  },
};

interface ProviderSettingsProps {
  onProvidersChanged?: () => void;
}

export default function ProviderSettings({ onProvidersChanged }: ProviderSettingsProps) {
  const { t } = useTranslation('settings');
  const [selectedProvider, setSelectedProvider] = useState<'claude' | 'openai' | 'gemini'>('claude');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get translated provider info
  const getProviderName = useCallback((type: string) => {
    return t(`providers.provider.${type}.name`, { defaultValue: type });
  }, [t]);

  const getProviderDescription = useCallback((type: string) => {
    return t(`providers.provider.${type}.description`, { defaultValue: '' });
  }, [t]);

  const loadCurrentProvider = useCallback(async () => {
    try {
      setLoading(true);
      const providers = await window.electronAPI.getProviders() as ProviderConfig[];

      // Find the primary enabled provider or first provider with API key
      const primary = providers.find(p => p.isPrimary && p.isEnabled);
      const withKey = providers.find(p => p.apiKey && p.apiKey.trim() !== '');
      const provider = primary || withKey || providers[0];

      if (provider) {
        setSelectedProvider(provider.provider);
        setApiKey(provider.apiKey || '');
      }
    } catch (err) {
      console.error('Failed to load provider:', err);
      setError(t('providers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load current provider on mount
  useEffect(() => {
    loadCurrentProvider();
  }, [loadCurrentProvider]);

  const saveProvider = useCallback(async (provider: 'claude' | 'openai' | 'gemini', key: string) => {
    try {
      // Get current providers
      const providers = await window.electronAPI.getProviders() as ProviderConfig[];

      // Update or create provider
      let updated = [...providers];
      const existingIndex = updated.findIndex(p => p.provider === provider);

      if (existingIndex >= 0) {
        // Update existing
        updated[existingIndex] = {
          ...updated[existingIndex],
          apiKey: key,
          isEnabled: key.trim() !== '',
          isPrimary: true,
        };
      } else {
        // Create new
        updated.push({
          provider,
          apiKey: key,
          isEnabled: key.trim() !== '',
          isPrimary: true,
          priority: updated.length + 1,
        });
      }

      // Unset other providers as primary
      updated = updated.map(p => ({
        ...p,
        isPrimary: p.provider === provider,
      }));

      await window.electronAPI.setProviders(updated);
      onProvidersChanged?.();
      setError(null);
    } catch (err) {
      console.error('Failed to save provider:', err);
      setError(t('providers.saveError'));
    }
  }, [t, onProvidersChanged]);

  const handleProviderChange = useCallback(async (newProvider: 'claude' | 'openai' | 'gemini') => {
    setSelectedProvider(newProvider);

    // Load API key for this provider
    try {
      const providers = await window.electronAPI.getProviders() as ProviderConfig[];
      const provider = providers.find(p => p.provider === newProvider);
      setApiKey(provider?.apiKey || '');
    } catch (err) {
      console.error('Failed to load provider API key:', err);
      setApiKey('');
    }
  }, []);

  const handleApiKeyChange = useCallback((newKey: string) => {
    setApiKey(newKey);
  }, []);

  const handleApiKeyBlur = useCallback(() => {
    // Save when user leaves the input field
    if (apiKey !== '') {
      saveProvider(selectedProvider, apiKey);
    }
  }, [selectedProvider, apiKey, saveProvider]);

  const info = PROVIDER_INFO[selectedProvider];

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-accent-primary" />
          <span className="text-sm font-medium">{t('providers.title')}</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Key size={14} className="text-accent-primary" />
        <span className="text-sm font-medium">{t('providers.title')}</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {/* Provider Dropdown */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">
          {t('providers.selectProvider')}
        </label>
        <select
          value={selectedProvider}
          onChange={(e) => handleProviderChange(e.target.value as 'claude' | 'openai' | 'gemini')}
          className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="claude">{getProviderName('claude')}</option>
          <option value="openai">{getProviderName('openai')}</option>
          <option value="gemini">{getProviderName('gemini')}</option>
        </select>
        <p className="text-xs text-gray-500">
          {getProviderDescription(selectedProvider)}
        </p>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">
          {t('providers.apiKey')}
        </label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            onBlur={handleApiKeyBlur}
            placeholder={`${info.keyPrefix}...`}
            className="w-full px-3 py-2 pr-10 bg-dark-hover border border-dark-border rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200"
            type="button"
          >
            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <a
            href={info.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI.openExternal(info.docsUrl);
            }}
          >
            {t('providers.getApiKey')}
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 bg-accent-primary/5 border border-accent-primary/20 rounded-lg">
        <p className="text-xs text-gray-300 leading-relaxed">
          {t('providers.singleProviderNote')}
        </p>
      </div>
    </div>
  );
}
