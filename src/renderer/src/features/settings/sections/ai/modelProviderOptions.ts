import type { ModelProviderId } from '@shared/types/modelProviders';
import type { KeyedProvider } from '@shared/types/secrets';

export type ProviderTrust = 'Direct API' | 'Proxy' | 'Local';

export interface ModelProviderOption {
  id: ModelProviderId;
  label: string;
  trust: ProviderTrust;
  hint: string;
}

export const MODEL_PROVIDER_OPTIONS: ModelProviderOption[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    trust: 'Direct API',
    hint: 'Strong reasoning and long-form response quality.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    trust: 'Direct API',
    hint: 'Balanced quality and speed for writing workflows.',
  },
  {
    id: 'google',
    label: 'Google',
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

/** Where each provider hands out API keys, opened in the browser. */
export const KEY_PAGE_URLS: Record<KeyedProvider, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/keys',
};
