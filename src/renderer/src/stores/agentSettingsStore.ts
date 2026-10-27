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
  google: 'gemini-3.8-flash',
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

const isKnownProvider = (value: unknown): value is ModelProviderId =>
  typeof value === 'string' && Object.hasOwn(DEFAULT_MODEL_BY_PROVIDER, value);

/** The stored model for each provider this build has, and the default for the rest. */
function pickModels(stored: unknown): Record<ModelProviderId, string> {
  const models = { ...DEFAULT_MODEL_BY_PROVIDER };
  if (typeof stored !== 'object' || stored === null) return models;
  for (const [provider, model] of Object.entries(stored)) {
    if (isKnownProvider(provider) && typeof model === 'string') models[provider] = model;
  }
  return models;
}

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
    }),
    {
      name: AGENT_SETTINGS_KEY,
      storage: createJSONStorage(() => settingsStorage),
      // A provider this build doesn't have (one renamed or removed) falls back to the default.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Record<keyof AgentSettingsState, unknown>>;
        return {
          ...current,
          ...(stored as Partial<AgentSettingsState>),
          provider: isKnownProvider(stored.provider) ? stored.provider : current.provider,
          modelsByProvider: pickModels(stored.modelsByProvider),
        };
      },
      // Hydrated by `hydrateStores` once boot has loaded the settings.
      skipHydration: true,
    }
  )
);
