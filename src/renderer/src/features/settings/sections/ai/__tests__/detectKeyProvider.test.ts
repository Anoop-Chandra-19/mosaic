import { describe, expect, it } from 'vitest';
import { detectKeyProvider } from '../detectKeyProvider';

describe('detectKeyProvider', () => {
  it.each([
    ['sk-ant-api03-made-up', 'anthropic'],
    ['sk-or-v1-made-up', 'openrouter'],
    ['AIzaSyMadeUp', 'gemini'],
    ['AQ.MadeUpKey', 'gemini'],
    ['sk-proj-made-up', 'openai'],
    ['sk-made-up', 'openai'],
    ['made-up-key', null],
  ])('reads %s as %s', (key, provider) => {
    expect(detectKeyProvider(key)).toBe(provider);
  });
});
