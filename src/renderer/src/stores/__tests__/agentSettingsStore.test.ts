import { describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => ({ value: null as string | null }));

// The store's settings storage is the window's; here it holds one record.
vi.mock('@/lib/storage/settingsStorage', () => ({
  settingsStorage: { getItem: () => stored.value, setItem: () => {}, removeItem: () => {} },
}));

const { DEFAULT_MODEL_BY_PROVIDER, useAgentSettingsStore } = await import('../agentSettingsStore');

describe('stored agent settings', () => {
  it('drop a provider this build doesn’t have, and fill in the models it lacks', async () => {
    stored.value = JSON.stringify({
      state: {
        enabled: true,
        provider: 'gemini',
        modelsByProvider: { gemini: 'gemini-3.8-pro', openai: 'gpt-5.6-luna', anthropic: 7 },
      },
      version: 0,
    });

    await useAgentSettingsStore.persist.rehydrate();

    const state = useAgentSettingsStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.provider).toBe('openai');
    expect(state.modelsByProvider).toEqual({
      ...DEFAULT_MODEL_BY_PROVIDER,
      openai: 'gpt-5.6-luna',
    });
  });
});
