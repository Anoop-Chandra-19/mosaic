import { describe, expect, it } from 'vitest';
import { findQueryInName, groupModelChoices, isModelListed } from '../groupModelChoices';

const headingsAndModels = (groups: ReturnType<typeof groupModelChoices>) =>
  groups.map((group) => [group.heading, group.choices.map((choice) => choice.model)]);

describe('groupModelChoices', () => {
  it('lists Mosaic’s pick, then Used before, then the rest of the key’s list, each once', () => {
    const groups = groupModelChoices({
      provider: 'anthropic',
      suggested: 'claude-sonnet-5',
      used: ['claude-opus-5', 'claude-sonnet-5'],
      listed: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-5'],
      query: '',
    });
    expect(headingsAndModels(groups)).toEqual([
      [null, ['claude-sonnet-5']],
      ['Used before', ['claude-opus-5']],
      ['From your key', ['claude-haiku-5']],
    ]);
    expect(groups[0].choices[0].tag).toBe('Mosaic’s pick');
  });

  it('keeps Used before even when the key doesn’t list them', () => {
    const groups = groupModelChoices({
      provider: 'openai',
      suggested: 'gpt-5.6-terra',
      used: ['gpt-old'],
      listed: [],
      query: '',
    });
    expect(headingsAndModels(groups)).toEqual([
      [null, ['gpt-5.6-terra']],
      ['Used before', ['gpt-old']],
    ]);
  });

  it('groups OpenRouter’s list by vendor, in the list’s order, with counts', () => {
    const groups = groupModelChoices({
      provider: 'openrouter',
      suggested: 'openai/gpt-5.6-terra',
      used: [],
      listed: ['openai/gpt-5.6-terra', 'qwen/qwen-4-max', 'openai/o5', 'anthropic/claude-sonnet-5'],
      query: '',
    });
    expect(groups.slice(1).map((group) => [group.heading, group.count])).toEqual([
      ['qwen', 1],
      ['openai', 1],
      ['anthropic', 1],
    ]);
  });

  it('keeps what matches the query in every group, ignoring case', () => {
    const groups = groupModelChoices({
      provider: 'openrouter',
      suggested: 'openai/gpt-5.6-terra',
      used: ['anthropic/claude-opus-5'],
      listed: ['anthropic/claude-sonnet-5', 'openai/o5', 'google/gemini-3.8-pro'],
      query: ' CLAUDE ',
    });
    expect(headingsAndModels(groups)).toEqual([
      ['Used before', ['anthropic/claude-opus-5']],
      ['anthropic', ['anthropic/claude-sonnet-5']],
    ]);
  });
});

describe('isModelListed', () => {
  it('finds Gemini’s model by either of its names', () => {
    expect(isModelListed(['gemini-3.8-flash'], 'models/gemini-3.8-flash')).toBe(true);
    expect(isModelListed(['gemini-3.8-flash'], 'gemini-3.8-flash')).toBe(true);
    expect(isModelListed(['gemini-3.8-flash'], 'gemini-3.8-pro')).toBe(false);
  });
});

describe('findQueryInName', () => {
  it('splits the name around the first match, keeping the name’s case', () => {
    expect(findQueryInName('anthropic/claude-Sonnet-5', 'sonnet')).toEqual({
      before: 'anthropic/claude-',
      match: 'Sonnet',
      after: '-5',
    });
    expect(findQueryInName('gpt-5', 'claude')).toBeNull();
    expect(findQueryInName('gpt-5', '  ')).toBeNull();
  });
});
