import { useState, useEffect, useCallback } from 'react';
import { Key, Eye, EyeOff, Check, Plus, GripVertical, Trash2, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';

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
 * Provider metadata for display
 */
const PROVIDER_INFO: Record<string, { name: string; description: string; docsUrl: string; keyPrefix: string }> = {
  claude: {
    name: 'Claude (Anthropic)',
    description: '고품질 프롬프트 개선, 뉘앙스 이해력 우수',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
  },
  openai: {
    name: 'ChatGPT (OpenAI)',
    description: '빠른 응답, 폭넓은 호환성',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
  },
  gemini: {
    name: 'Gemini (Google)',
    description: '빠른 추론, 긴 컨텍스트 지원',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
  },
};

interface ProviderSettingsProps {
  onProvidersChanged?: () => void;
}

export default function ProviderSettings({ onProvidersChanged }: ProviderSettingsProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [validatingKey, setValidatingKey] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, { valid: boolean; error?: string }>>({});
  const [showAddProvider, setShowAddProvider] = useState(false);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const loaded = await window.electronAPI.getProviders();
      setProviders(loaded as ProviderConfig[]);
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProviders = useCallback(async (newProviders: ProviderConfig[]) => {
    try {
      await window.electronAPI.setProviders(newProviders);
      setProviders(newProviders);
      onProvidersChanged?.();
    } catch (error) {
      console.error('Failed to save providers:', error);
    }
  }, [onProvidersChanged]);

  const updateProvider = useCallback((index: number, updates: Partial<ProviderConfig>) => {
    const updated = [...providers];
    updated[index] = { ...updated[index], ...updates };

    // If setting as primary, unset others
    if (updates.isPrimary) {
      updated.forEach((p, i) => {
        if (i !== index) p.isPrimary = false;
      });
    }

    saveProviders(updated);
  }, [providers, saveProviders]);

  const removeProvider = useCallback((index: number) => {
    const updated = providers.filter((_, i) => i !== index);
    // Ensure at least one primary if any enabled
    const hasEnabledPrimary = updated.some(p => p.isPrimary && p.isEnabled);
    if (!hasEnabledPrimary && updated.length > 0) {
      const firstEnabled = updated.find(p => p.isEnabled);
      if (firstEnabled) firstEnabled.isPrimary = true;
    }
    saveProviders(updated);
  }, [providers, saveProviders]);

  const addProvider = useCallback((type: 'claude' | 'openai' | 'gemini') => {
    // Check if already exists
    if (providers.some(p => p.provider === type)) {
      setShowAddProvider(false);
      return;
    }

    const newProvider: ProviderConfig = {
      provider: type,
      apiKey: '',
      isEnabled: false,
      isPrimary: providers.length === 0, // First provider is primary
      priority: providers.length + 1,
    };

    saveProviders([...providers, newProvider]);
    setShowAddProvider(false);
  }, [providers, saveProviders]);

  const validateKey = useCallback(async (providerType: string, apiKey: string) => {
    if (!apiKey || apiKey.trim() === '') {
      setValidationResults(prev => ({
        ...prev,
        [providerType]: { valid: false, error: 'API 키를 입력해주세요' },
      }));
      return;
    }

    setValidatingKey(providerType);
    try {
      const result = await window.electronAPI.validateProviderKey(providerType, apiKey);
      setValidationResults(prev => ({
        ...prev,
        [providerType]: result,
      }));
    } catch {
      setValidationResults(prev => ({
        ...prev,
        [providerType]: { valid: false, error: '검증 중 오류가 발생했습니다' },
      }));
    } finally {
      setValidatingKey(null);
    }
  }, []);

  const toggleShowApiKey = useCallback((type: string) => {
    setShowApiKeys(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // Get available providers to add
  const availableToAdd = ['claude', 'openai', 'gemini'].filter(
    type => !providers.some(p => p.provider === type)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-accent-primary" />
          <span className="text-sm font-medium">AI 프로바이더</span>
        </div>
        {availableToAdd.length > 0 && (
          <button
            onClick={() => setShowAddProvider(!showAddProvider)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
          >
            <Plus size={12} />
            추가
          </button>
        )}
      </div>

      {/* Add Provider Dropdown */}
      {showAddProvider && availableToAdd.length > 0 && (
        <div className="p-2 bg-dark-hover border border-dark-border rounded-lg space-y-1">
          <p className="text-xs text-gray-400 mb-2">프로바이더 추가:</p>
          {availableToAdd.map((type) => (
            <button
              key={type}
              onClick={() => addProvider(type as 'claude' | 'openai' | 'gemini')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-200 hover:bg-dark-surface rounded transition-colors"
            >
              <span>{PROVIDER_INFO[type].name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Provider List */}
      {providers.length === 0 ? (
        <div className="p-4 bg-dark-hover/50 border border-dark-border rounded-lg text-center">
          <p className="text-sm text-gray-400">등록된 AI 프로바이더가 없습니다</p>
          <p className="text-xs text-gray-500 mt-1">위의 + 추가 버튼을 눌러 프로바이더를 등록하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider, index) => {
            const info = PROVIDER_INFO[provider.provider];
            const isValidating = validatingKey === provider.provider;
            const validationResult = validationResults[provider.provider];
            const showKey = showApiKeys[provider.provider];

            return (
              <div
                key={provider.provider}
                className={`p-3 bg-dark-hover border rounded-lg transition-colors ${
                  provider.isEnabled ? 'border-accent-primary/30' : 'border-dark-border'
                }`}
              >
                {/* Provider Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-200">{info.name}</span>
                    {provider.isPrimary && (
                      <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary text-[10px] rounded">
                        기본
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Enable Toggle */}
                    <button
                      onClick={() => updateProvider(index, { isEnabled: !provider.isEnabled })}
                      disabled={!provider.apiKey}
                      className={`relative w-8 h-4 rounded-full transition-colors ${
                        provider.isEnabled ? 'bg-accent-primary' : 'bg-dark-border'
                      } ${!provider.apiKey ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                          provider.isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    {/* Remove */}
                    <button
                      onClick={() => removeProvider(index)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 mb-3">{info.description}</p>

                {/* API Key Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={provider.apiKey}
                      onChange={(e) => {
                        updateProvider(index, { apiKey: e.target.value });
                        // Clear validation when key changes
                        setValidationResults(prev => {
                          const newResults = { ...prev };
                          delete newResults[provider.provider];
                          return newResults;
                        });
                      }}
                      placeholder={`${info.keyPrefix}...`}
                      className="w-full px-3 py-2 pr-20 bg-dark-surface border border-dark-border rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-primary font-mono"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        onClick={() => toggleShowApiKey(provider.provider)}
                        className="p-1 text-gray-400 hover:text-gray-200"
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => validateKey(provider.provider, provider.apiKey)}
                        disabled={isValidating || !provider.apiKey}
                        className={`p-1 transition-colors ${
                          isValidating || !provider.apiKey
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-gray-400 hover:text-accent-primary'
                        }`}
                        title="키 검증"
                      >
                        {isValidating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Validation Result */}
                  {validationResult && (
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        validationResult.valid ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {validationResult.valid ? (
                        <>
                          <Check size={12} />
                          <span>유효한 API 키입니다</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={12} />
                          <span>{validationResult.error || 'API 키가 유효하지 않습니다'}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Actions */}
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
                      API 키 발급
                      <ExternalLink size={10} />
                    </a>
                    {!provider.isPrimary && provider.isEnabled && (
                      <button
                        onClick={() => updateProvider(index, { isPrimary: true })}
                        className="text-xs text-gray-400 hover:text-accent-primary transition-colors"
                      >
                        기본으로 설정
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="p-2.5 bg-accent-primary/5 border border-accent-primary/20 rounded-lg">
        <p className="text-xs text-gray-300 leading-relaxed">
          <strong className="text-accent-primary">Fallback 지원:</strong> 기본 프로바이더 실패 시 다음 프로바이더로 자동 전환됩니다.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          • 모든 API 키는 이 기기에만 저장됩니다 (서버 전송 없음)
        </p>
      </div>
    </div>
  );
}
