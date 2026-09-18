import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_OLLAMA_ADDRESS } from '@shared/ai/ollamaAddress';
import { settingsStorage } from '@/lib/storage/settingsStorage';
import type { AiProvider } from '@shared/types/resume';

/**
 * Each provider's current mid tier — capable enough for resume writing, without the top
 * tier's price. Checked against the providers' model lists on 2026-09-14. Ollama's has to
 * be pulled first (`ollama pull qwen3.5:9b`); Test checks the others can be reached.
 */
export const AI_PROVIDER_DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: 'gpt-5.6-terra',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-3.8-flash',
  ollama: 'qwen3.5:9b',
  openrouter: 'openai/gpt-5.6-terra',
};

function createDefaultModelsByProvider(): Record<AiProvider, string> {
  return { ...AI_PROVIDER_DEFAULT_MODEL };
}

export const DEFAULT_AI_STATE = {
  enabled: false,
  provider: 'openai' as AiProvider,
  modelsByProvider: createDefaultModelsByProvider(),
  /** Where Ollama is: this machine unless it runs somewhere on the network. */
  ollamaAddress: DEFAULT_OLLAMA_ADDRESS,
};

interface AiStoreState {
  enabled: boolean;
  provider: AiProvider;
  modelsByProvider: Record<AiProvider, string>;
  ollamaAddress: string;
  setEnabled: (enabled: boolean) => void;
  /** Takes an address already checked with `normalizeOllamaAddress`. */
  setOllamaAddress: (address: string) => void;
  setProvider: (provider: AiProvider) => void;
  setModelForProvider: (provider: AiProvider, model: string) => void;
  setModelForActiveProvider: (model: string) => void;
  resetModelForProvider: (provider: AiProvider) => void;
}

type LegacyAiState = {
  enabled?: boolean;
  provider?: AiProvider;
  model?: string;
  modelsByProvider?: Partial<Record<AiProvider, string>>;
  ollamaAddress?: string;
};

function normalizePersistedAiState(persisted: unknown): typeof DEFAULT_AI_STATE {
  const parsed = (persisted ?? {}) as LegacyAiState;

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
    ollamaAddress: parsed.ollamaAddress ?? DEFAULT_OLLAMA_ADDRESS,
  };
}

export const useAiStore = create<AiStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AI_STATE,
      setEnabled: (enabled) => set({ enabled }),
      setOllamaAddress: (ollamaAddress) => set({ ollamaAddress }),
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
    }),
    {
      name: 'ai',
      version: 1,
      migrate: (persistedState) => normalizePersistedAiState(persistedState),
      storage: createJSONStorage(() => settingsStorage),
      // Hydrated by `hydrateStores` once boot has loaded the settings.
      skipHydration: true,
    }
  )
);
