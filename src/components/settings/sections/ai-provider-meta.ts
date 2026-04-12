import type { AIProvider } from '@/types/resume';

export type ProviderTrust = 'Direct API' | 'Proxy' | 'Local';

export interface ProviderOption {
  id: AIProvider;
  label: string;
  trust: ProviderTrust;
  requiresKey: boolean;
  hint: string;
}

export const AI_PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    trust: 'Direct API',
    requiresKey: true,
    hint: 'Balanced quality and speed for writing workflows.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    trust: 'Direct API',
    requiresKey: true,
    hint: 'Strong reasoning and long-form response quality.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    trust: 'Direct API',
    requiresKey: true,
    hint: 'Good cost-performance for frequent iterations.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    trust: 'Proxy',
    requiresKey: true,
    hint: 'One gateway for multiple hosted providers.',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    trust: 'Local',
    requiresKey: false,
    hint: 'Runs locally for maximum privacy.',
  },
];

export const AI_PROVIDER_BY_ID = AI_PROVIDER_OPTIONS.reduce(
  (acc, provider) => ({ ...acc, [provider.id]: provider }),
  {} as Record<AIProvider, ProviderOption>
);
