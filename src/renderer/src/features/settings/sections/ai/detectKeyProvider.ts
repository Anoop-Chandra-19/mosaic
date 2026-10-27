import type { KeyedProvider } from '@shared/types/secrets';

/** Most specific first: every prefix but Google's starts like OpenAI's. */
const KEY_PREFIXES: [prefix: string, provider: KeyedProvider][] = [
  ['sk-ant-', 'anthropic'],
  ['sk-or-', 'openrouter'],
  ['AIza', 'google'],
  // Google's newer keys.
  ['AQ.', 'google'],
  ['sk-', 'openai'],
];

/** The provider a key's prefix says it is from, or null when the prefix says nothing. */
export function detectKeyProvider(key: string): KeyedProvider | null {
  return KEY_PREFIXES.find(([prefix]) => key.startsWith(prefix))?.[1] ?? null;
}
