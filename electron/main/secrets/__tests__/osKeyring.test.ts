import { describe, expect, it } from 'vitest';
import { isKernelKeyringEntry } from '../osKeyring';

// Lines as /proc/keys printed them when @napi-rs/keyring fell back to the kernel keyring.
const LIVE =
  '08a4cb9b I--Q---     2 perm 3f010000  1000  1000 user      keyring:anthropic@Mosaic (dev): 12';
const INVALIDATED =
  '08a4cb9b I--Q--i     2 perm 3f010000  1000  1000 user      keyring:anthropic@Mosaic (dev): 12';
const SESSION_KEYRING = '19c0f5a1 I--Q---    12 perm 3f030000  1000  1000 keyring   _ses: 1';

describe('isKernelKeyringEntry', () => {
  it('finds a live entry for the account', () => {
    const procKeys = [SESSION_KEYRING, LIVE].join('\n');
    expect(isKernelKeyringEntry(procKeys, 'Mosaic (dev)', 'anthropic')).toBe(true);
  });

  it('ignores invalidated entries, other accounts, and other services', () => {
    expect(isKernelKeyringEntry(INVALIDATED, 'Mosaic (dev)', 'anthropic')).toBe(false);
    expect(isKernelKeyringEntry(LIVE, 'Mosaic (dev)', 'openai')).toBe(false);
    expect(isKernelKeyringEntry(LIVE, 'Mosaic', 'anthropic')).toBe(false);
    expect(isKernelKeyringEntry('', 'Mosaic', 'anthropic')).toBe(false);
  });
});
