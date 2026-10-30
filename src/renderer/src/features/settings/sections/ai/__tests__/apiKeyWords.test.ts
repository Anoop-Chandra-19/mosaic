import { describe, expect, it } from 'vitest';
import type { SavedKey, SecretsStatus } from '@shared/types/secrets';
import { describeSavedKey, readKeyState } from '../apiKeyWords';

const NOW = new Date(2026, 9, 29, 14, 6).getTime();
const HOUR_AGO = NOW - 60 * 60 * 1000;

const status = (saved: SavedKey): SecretsStatus => ({
  keychain: 'available',
  saved: { openai: saved },
});

describe('a key its provider refused in a run', () => {
  const refused: SavedKey = {
    where: 'keychain',
    savedAt: HOUR_AGO,
    checkedAt: HOUR_AGO,
    refusedAt: HOUR_AGO,
  };

  it('stands as refused, whatever its last check said', () => {
    expect(readKeyState('openai', status(refused))).toBe('refused');
  });

  it('says who refused it in place of the last check', () => {
    const { savedLine, checkedLine } = describeSavedKey(refused, 'available', 'OpenAI', NOW);
    expect(savedLine).toMatch(/^Saved .+ in your keychain$/);
    expect(checkedLine).toMatch(/^OpenAI refused it .+/);
  });
});
