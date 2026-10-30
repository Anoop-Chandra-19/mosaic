import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AGENT_SETTINGS_KEY } from '@shared/types/modelProviders';
import { openDatabase, type Database } from '../../db/connection';
import { setSetting } from '../../db/settings';
import { readModelChoice } from '../readModelChoice';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => db.close());

const SETTINGS = {
  enabled: true,
  provider: 'ollama',
  modelsByProvider: { ollama: 'qwen3.5:9b' },
  ollamaAddress: 'gpu-box',
  ollamaContextTokens: 32_768,
};

const store = (state: unknown) =>
  setSetting(db, AGENT_SETTINGS_KEY, JSON.stringify({ state, version: 0 }));

describe('readModelChoice', () => {
  it('reads what Settings chose, with the Ollama address written out', () => {
    store(SETTINGS);
    expect(readModelChoice(db)).toEqual({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      ollama: { address: 'http://gpu-box:11434', contextTokens: 32_768 },
      // Saved before this provider existed.
      openAiCompatible: { address: 'http://127.0.0.1:8080' },
    });
  });

  it('reads an OpenAI-compatible server’s model and address', () => {
    store({
      ...SETTINGS,
      provider: 'openaiCompatible',
      modelsByProvider: { openaiCompatible: 'local-model' },
      openAiCompatibleAddress: 'gpu-box',
    });
    expect(readModelChoice(db)).toMatchObject({
      provider: 'openaiCompatible',
      model: 'local-model',
      openAiCompatible: { address: 'http://gpu-box:8080' },
    });
  });

  it.each<[string, unknown]>([
    ['the assistant off', { ...SETTINGS, enabled: false }],
    ['an unknown provider', { ...SETTINGS, provider: 'toString' }],
    ['no model for the provider', { ...SETTINGS, modelsByProvider: {} }],
    ['an address that isn’t one', { ...SETTINGS, ollamaAddress: 'ftp://gpu-box' }],
    ['a server address that isn’t one', { ...SETTINGS, openAiCompatibleAddress: 'ftp://gpu-box' }],
    ['a window of 0 tokens', { ...SETTINGS, ollamaContextTokens: 0 }],
  ])('is null with %s', (_, state) => {
    store(state);
    expect(readModelChoice(db)).toBeNull();
  });

  it('is null with nothing stored, or settings that aren’t JSON', () => {
    expect(readModelChoice(db)).toBeNull();
    setSetting(db, AGENT_SETTINGS_KEY, '{');
    expect(readModelChoice(db)).toBeNull();
  });
});
