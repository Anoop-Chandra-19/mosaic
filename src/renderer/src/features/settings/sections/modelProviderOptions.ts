import type { ModelProviderId } from '@shared/types/modelProviders';

export type ProviderTrust = 'Direct API' | 'Proxy' | 'Local';

export interface ModelProviderOption {
  id: ModelProviderId;
  label: string;
  trust: ProviderTrust;
  hint: string;
}

export const MODEL_PROVIDER_OPTIONS: ModelProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    trust: 'Direct API',
    hint: 'Balanced quality and speed for writing workflows.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    trust: 'Direct API',
    hint: 'Strong reasoning and long-form response quality.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    trust: 'Direct API',
    hint: 'Good cost-performance for frequent iterations.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    trust: 'Proxy',
    hint: 'One gateway for multiple hosted providers.',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    trust: 'Local',
    hint: 'Runs locally for maximum privacy.',
  },
];

export const MODEL_PROVIDER_OPTION_BY_ID = MODEL_PROVIDER_OPTIONS.reduce(
  (acc, provider) => ({ ...acc, [provider.id]: provider }),
  {} as Record<ModelProviderId, ModelProviderOption>
);
