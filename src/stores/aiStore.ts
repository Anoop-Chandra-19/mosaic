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

export const DEFAULT_AI_STATE = {
  enabled: false,
  provider: 'openai' as AIProvider,
  model: AI_PROVIDER_DEFAULT_MODEL.openai,
};

interface AIStoreState {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  setEnabled: (enabled: boolean) => void;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: string) => void;
  useSuggestedModel: () => void;
  resetAIConfig: () => void;
}

export const useAIStore = create<AIStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AI_STATE,
      setEnabled: (enabled) => set({ enabled }),
      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),
      useSuggestedModel: () => {
        const provider = get().provider;
        set({ model: AI_PROVIDER_DEFAULT_MODEL[provider] });
      },
      resetAIConfig: () => set({ ...DEFAULT_AI_STATE }),
    }),
    {
      name: 'mosaic-ai',
      storage: createJSONStorage(() => dexieStorage),
    }
  )
);
