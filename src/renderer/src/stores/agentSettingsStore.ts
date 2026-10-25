import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_OLLAMA_ADDRESS } from '@shared/model-providers/ollamaAddress';
import { settingsStorage } from '@/lib/storage/settingsStorage';
import { AGENT_SETTINGS_KEY, type ModelProviderId } from '@shared/types/modelProviders';

/**
 * Each provider's current mid tier — capable enough for resume writing, without the top
 * tier's price. Checked against the providers' model lists on 2026-09-14. Ollama's has to
 * be pulled first (`ollama pull qwen3.5:9b`); Test checks the others can be reached.
 */
export const DEFAULT_MODEL_BY_PROVIDER: Record<ModelProviderId, string> = {
  openai: 'gpt-5.6-terra',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-3.8-flash',
  ollama: 'qwen3.5:9b',
  openrouter: 'openai/gpt-5.6-terra',
};

const DEFAULT_AGENT_SETTINGS = {
  enabled: false,
  provider: 'openai' as ModelProviderId,
  modelsByProvider: { ...DEFAULT_MODEL_BY_PROVIDER },
  /** Where Ollama is: this machine unless it runs somewhere on the network. */
  ollamaAddress: DEFAULT_OLLAMA_ADDRESS,
  /** Null leaves the window to Ollama's own setting. */
  ollamaContextTokens: null as number | null,
};

interface AgentSettingsState {
  enabled: boolean;
  provider: ModelProviderId;
  modelsByProvider: Record<ModelProviderId, string>;
  ollamaAddress: string;
  ollamaContextTokens: number | null;
  setEnabled: (enabled: boolean) => void;
  /** Takes an address already checked with `normalizeOllamaAddress`. */
  setOllamaAddress: (address: string) => void;
  setOllamaContextTokens: (tokens: number | null) => void;
  setProvider: (provider: ModelProviderId) => void;
  setModelForProvider: (provider: ModelProviderId, model: string) => void;
  setModelForActiveProvider: (model: string) => void;
  resetModelForProvider: (provider: ModelProviderId) => void;
}

export const useAgentSettingsStore = create<AgentSettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AGENT_SETTINGS,
      setEnabled: (enabled) => set({ enabled }),
      setOllamaAddress: (ollamaAddress) => set({ ollamaAddress }),
      setOllamaContextTokens: (ollamaContextTokens) => set({ ollamaContextTokens }),
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
            [provider]: DEFAULT_MODEL_BY_PROVIDER[provider],
          },
        })),
    }),
    {
      name: AGENT_SETTINGS_KEY,
      storage: createJSONStorage(() => settingsStorage),
      // Hydrated by `hydrateStores` once boot has loaded the settings.
      skipHydration: true,
    }
  )
);
