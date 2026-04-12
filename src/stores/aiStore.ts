import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { dexieStorage } from '@/lib/dexieStorage';
import type { AIProvider } from '@/types/resume';

export const AI_PROVIDER_DEFAULT_MODEL: Record<AIProvider, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.1:8b',
  openrouter: 'openai/gpt-4o-mini',
};

function createDefaultModelsByProvider(): Record<AIProvider, string> {
  return { ...AI_PROVIDER_DEFAULT_MODEL };
}

export const DEFAULT_AI_STATE = {
  enabled: false,
  provider: 'openai' as AIProvider,
  modelsByProvider: createDefaultModelsByProvider(),
};

interface AIStoreState {
  enabled: boolean;
  provider: AIProvider;
  modelsByProvider: Record<AIProvider, string>;
  setEnabled: (enabled: boolean) => void;
  setProvider: (provider: AIProvider) => void;
  setModelForProvider: (provider: AIProvider, model: string) => void;
  setModelForActiveProvider: (model: string) => void;
  resetModelForProvider: (provider: AIProvider) => void;
  resetAIConfig: () => void;
}

type LegacyAIState = {
  enabled?: boolean;
  provider?: AIProvider;
  model?: string;
  modelsByProvider?: Partial<Record<AIProvider, string>>;
};

function normalizePersistedAIState(persisted: unknown): typeof DEFAULT_AI_STATE {
  const parsed = (persisted ?? {}) as LegacyAIState;

  const provider = parsed.provider ?? DEFAULT_AI_STATE.provider;
  const modelsByProvider = {
    ...createDefaultModelsByProvider(),
    ...(parsed.modelsByProvider ?? {}),
  };

  if (
    !parsed.modelsByProvider &&
    typeof parsed.model === 'string' &&
    parsed.model.trim().length > 0
  ) {
    modelsByProvider[provider] = parsed.model;
  }

  return {
    enabled: parsed.enabled ?? DEFAULT_AI_STATE.enabled,
    provider,
    modelsByProvider,
  };
}

export const useAIStore = create<AIStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AI_STATE,
      setEnabled: (enabled) => set({ enabled }),
      setProvider: (provider) => set({ provider }),
      setModelForProvider: (provider, model) =>
        set((state) => ({
          modelsByProvider: {
            ...state.modelsByProvider,
            [provider]: model,
          },
        })),
      setModelForActiveProvider: (model) => {
        const provider = get().provider;
        set((state) => ({
          modelsByProvider: {
            ...state.modelsByProvider,
            [provider]: model,
          },
        }));
      },
      resetModelForProvider: (provider) =>
        set((state) => ({
          modelsByProvider: {
            ...state.modelsByProvider,
            [provider]: AI_PROVIDER_DEFAULT_MODEL[provider],
          },
        })),
      resetAIConfig: () =>
        set({ ...DEFAULT_AI_STATE, modelsByProvider: createDefaultModelsByProvider() }),
    }),
    {
      name: 'mosaic-ai',
      version: 1,
      migrate: (persistedState) => normalizePersistedAIState(persistedState),
      storage: createJSONStorage(() => dexieStorage),
    }
  )
);
