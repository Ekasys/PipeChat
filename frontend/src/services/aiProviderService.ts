import api from './api'

export interface AIProvider {
  id: string
  provider_name: string
  display_name: string
  is_active: boolean
  is_default: boolean
  connection_config: {
    api_key?: string
    api_endpoint?: string
    base_url?: string
    default_model?: string
    temperature?: number
    max_tokens?: number
    organization?: string
    azure_endpoint?: string
    api_version?: string
    chat_deployment?: string
    embedding_deployment?: string
    auth_mode?: 'api-key' | 'managed-identity'
  }
  created_at?: string
  updated_at?: string
}

export interface ModelOption {
  value: string
  label: string
}

const PROVIDER_MODELS: Record<string, ModelOption[]> = {
  'azure-openai': [
    { value: 'balanced-mid', label: 'Balanced Mid (Deployment Name)' },
    { value: 'cost-mini', label: 'Cost Mini (Deployment Name)' },
    { value: 'high-cap', label: 'High Capability (Deployment Name)' },
  ],
  chatgpt: [
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
    { value: 'gpt-5-codex', label: 'GPT-5-Codex' },
    { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat Latest' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: 'gemini-ultra', label: 'Gemini Ultra' },
  ],
  grok: [
    { value: 'grok-2', label: 'Grok-2' },
    { value: 'grok-beta', label: 'Grok Beta' },
    { value: 'grok-vision-beta', label: 'Grok Vision Beta' },
  ],
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'llama3', label: 'Llama 3' },
    { value: 'llama2', label: 'Llama 2' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'mixtral', label: 'Mixtral' },
    { value: 'codellama', label: 'CodeLlama' },
    { value: 'phi', label: 'Phi' },
    { value: 'neural-chat', label: 'Neural Chat' },
  ],
  'ollama-cloud': [
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'llama3', label: 'Llama 3' },
    { value: 'llama2', label: 'Llama 2' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'mixtral', label: 'Mixtral' },
    { value: 'codellama', label: 'CodeLlama' },
    { value: 'phi', label: 'Phi' },
    { value: 'neural-chat', label: 'Neural Chat' },
  ],
}

export const aiProviderService = {
  list: async (): Promise<{ providers: AIProvider[] }> => {
    const response = await api.get<{ providers: AIProvider[] }>('/admin/ai-providers')
    return response.data
  },

  getDefault: async (): Promise<AIProvider | null> => {
    try {
      const { providers } = await aiProviderService.list()
      const defaultProvider = providers.find((p) => p.is_default && p.is_active)
      return defaultProvider || providers.find((p) => p.is_active) || null
    } catch (error) {
      console.error('Failed to get default provider:', error)
      return null
    }
  },

  getModelsForProvider: (providerName: string): ModelOption[] => {
    return PROVIDER_MODELS[providerName] || PROVIDER_MODELS.chatgpt
  },

  getDefaultModel: (provider: AIProvider | null): string => {
    if (!provider) return 'gpt-5-mini'

    if (provider.provider_name === 'azure-openai') {
      if (provider.connection_config?.chat_deployment) {
        return provider.connection_config.chat_deployment
      }
      if (provider.connection_config?.default_model) {
        return provider.connection_config.default_model
      }
      return 'balanced-mid'
    }

    if (provider?.connection_config?.default_model) {
      return provider.connection_config.default_model
    }

    const models = aiProviderService.getModelsForProvider(provider.provider_name || 'chatgpt')
    return models[0]?.value || 'gpt-5-mini'
  },
}
