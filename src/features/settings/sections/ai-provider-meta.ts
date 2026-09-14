import type { AIProvider } from '@/types/resume';

export type ProviderTrust = 'Direct API' | 'Proxy' | 'Local';

export interface ProviderOption {
  id: AIProvider;
  label: string;
  trust: ProviderTrust;
  hint: string;
}

export const AI_PROVIDER_OPTIONS: ProviderOption[] = [
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

export const AI_PROVIDER_BY_ID = AI_PROVIDER_OPTIONS.reduce(
  (acc, provider) => ({ ...acc, [provider.id]: provider }),
  {} as Record<AIProvider, ProviderOption>
);
