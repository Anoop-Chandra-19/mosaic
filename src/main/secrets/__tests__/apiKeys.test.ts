import { beforeEach, describe, expect, it } from 'vitest';
import { createApiKeys, KeychainError, type ApiKeys, type SaveOptions } from '../apiKeys';
import { fakeKeyring, memoryStorage } from './fakeKeyring';

let os: ReturnType<typeof fakeKeyring>;
let storage: ReturnType<typeof memoryStorage>;
let clock: number;
let keys: ApiKeys;

const SECRET = 'sk-ant-secret-value';
const CHECKED: SaveOptions = { forgetOnClose: false, checked: true };
const FORGET: SaveOptions = { forgetOnClose: true, checked: true };

beforeEach(() => {
  os = fakeKeyring();
  storage = memoryStorage();
  clock = 1_000;
  keys = createApiKeys(os.keyring, storage, () => clock);
});

describe('API keys', () => {
  it('go to the keychain, and the settings note holds dates only', async () => {
    const status = await keys.save('anthropic', SECRET, CHECKED);

    expect(status).toEqual({
      keychain: 'available',
      saved: { anthropic: { where: 'keychain', savedAt: 1_000, checkedAt: 1_000 } },
    });
    expect(os.entries.get('anthropic')).toBe(SECRET);
    expect(storage.value).not.toContain(SECRET);
    expect(JSON.parse(storage.value!)).toEqual({
      keychain: { anthropic: { savedAt: 1_000, checkedAt: 1_000 } },
    });
    expect(await keys.read('anthropic')).toBe(SECRET);
  });

  it('report their status without touching the keychain', async () => {
    await keys.save('openai', SECRET, { forgetOnClose: false, checked: false });
    os.calls.length = 0;

    // A fresh launch over the same settings: the note is enough.
    const relaunched = createApiKeys(os.keyring, storage);
    expect(await relaunched.status()).toEqual({
      keychain: 'unknown',
      saved: { openai: { where: 'keychain', savedAt: 1_000, checkedAt: null } },
    });
    expect(os.calls).toEqual([]);
  });

  it('read a note they cannot make sense of as no keys', async () => {
    storage.value = JSON.stringify({ location: 'keychain', keychain: ['anthropic'] });
    expect(await keys.status()).toMatchObject({ saved: {} });
  });

  it('stay in memory when asked to forget them on close, replacing a keychain copy', async () => {
    await keys.save('anthropic', 'sk-old', CHECKED);
    clock = 2_000;

    const status = await keys.save('anthropic', SECRET, FORGET);

    expect(status.saved).toEqual({
      anthropic: { where: 'session', savedAt: 2_000, checkedAt: 2_000 },
    });
    expect(os.entries.has('anthropic')).toBe(false);
    expect(JSON.parse(storage.value!)).toEqual({ keychain: {} });
    expect(await keys.read('anthropic')).toBe(SECRET);
  });

  it('go back to the keychain when saved again to keep', async () => {
    await keys.save('anthropic', 'sk-old', FORGET);
    await keys.save('anthropic', SECRET, CHECKED);

    expect(os.entries.get('anthropic')).toBe(SECRET);
    expect(await keys.status()).toMatchObject({ saved: { anthropic: { where: 'keychain' } } });
  });

  it('stay for the session when the keychain refuses, and stop asking it', async () => {
    os.refusing.add('set');

    const status = await keys.save('anthropic', SECRET, CHECKED);
    expect(status).toMatchObject({
      keychain: 'unavailable',
      saved: { anthropic: { where: 'session' } },
    });
    expect(await keys.read('anthropic')).toBe(SECRET);

    os.calls.length = 0;
    await keys.save('openai', 'sk-other', CHECKED);
    expect(os.calls).toEqual([]);
  });

  it('note a check of the key it was for, and not of one saved since', async () => {
    await keys.save('anthropic', SECRET, { forgetOnClose: false, checked: false });
    await keys.save('openai', 'sk-openai', { forgetOnClose: true, checked: false });
    clock = 5_000;

    await keys.markChecked('anthropic', 1_000);
    await keys.markChecked('openai', 1_000);
    expect((await keys.status()).saved).toEqual({
      anthropic: { where: 'keychain', savedAt: 1_000, checkedAt: 5_000 },
      openai: { where: 'session', savedAt: 1_000, checkedAt: 5_000 },
    });

    clock = 6_000;
    await keys.save('anthropic', 'sk-newer', { forgetOnClose: false, checked: false });
    await keys.markChecked('anthropic', 1_000);
    expect((await keys.status()).saved.anthropic).toMatchObject({ checkedAt: null });
  });

  it.each<[string, SaveOptions]>([
    ['in the keychain', CHECKED],
    ['for the session', FORGET],
  ])('note a refusal of a key %s until a run finishes or a check passes', async (_, options) => {
    await keys.save('openai', SECRET, options);
    clock = 5_000;

    await keys.markRefused('openai', 1_000);
    expect((await keys.status()).saved.openai).toMatchObject({ refusedAt: 5_000 });

    await keys.clearRefused('openai');
    expect((await keys.status()).saved.openai).not.toHaveProperty('refusedAt');

    await keys.markRefused('openai', 1_000);
    await keys.markChecked('openai', 1_000);
    expect((await keys.status()).saved.openai).not.toHaveProperty('refusedAt');
  });

  it('keep a refusal across launches, and never put it on a key saved after the run began', async () => {
    await keys.save('openai', SECRET, CHECKED);
    clock = 5_000;
    await keys.markRefused('openai', 1_000);
    const relaunched = createApiKeys(os.keyring, storage, () => clock);
    expect((await relaunched.status()).saved.openai).toMatchObject({ refusedAt: 5_000 });

    await keys.save('openai', 'sk-newer', CHECKED);
    await keys.markRefused('openai', 1_000);
    expect((await keys.status()).saved.openai).not.toHaveProperty('refusedAt');
  });

  it('are removed from wherever they are', async () => {
    await keys.save('anthropic', SECRET, CHECKED);
    await keys.save('openai', 'sk-openai', FORGET);

    await keys.remove('anthropic');
    await keys.remove('openai');

    expect(os.entries.size).toBe(0);
    expect(await keys.status()).toMatchObject({ saved: {} });
    expect(await keys.read('anthropic')).toBeUndefined();
  });

  it('are all forgotten, including keychain entries Mosaic has no note of', async () => {
    await keys.save('anthropic', SECRET, CHECKED);
    os.entries.set('google', 'left by an earlier install');
    await keys.save('openai', 'sk-session', FORGET);

    expect(await keys.forgetAll()).toEqual({
      status: { keychain: 'available', saved: {} },
      unconfirmed: [],
    });
    expect(os.entries.size).toBe(0);
    expect(await keys.read('openai')).toBeUndefined();
  });

  it('are not reported forgotten while the keychain still holds one on record', async () => {
    await keys.save('anthropic', SECRET, CHECKED);
    os.refusing.add('delete');

    await expect(keys.forgetAll()).rejects.toThrow();
    expect(await keys.status()).toMatchObject({ saved: { anthropic: { where: 'keychain' } } });
  });

  it('report the entries with no record that the keychain would not delete', async () => {
    os.refusing.add('delete');

    expect(await keys.forgetAll()).toEqual({
      status: { keychain: 'unknown', saved: {} },
      unconfirmed: ['openai', 'anthropic', 'google', 'openrouter'],
    });
  });

  it('take a key back from the keychain when its note cannot be written', async () => {
    storage.isRefusing = true;

    expect((await keys.save('anthropic', SECRET, CHECKED)).saved).toEqual({
      anthropic: { where: 'session', savedAt: 1_000, checkedAt: 1_000 },
    });
    expect(os.entries.size).toBe(0);
    expect(await keys.read('anthropic')).toBe(SECRET);
  });

  it('confirm a key gone that has no note and would not be taken back', async () => {
    storage.isRefusing = true;
    os.refusing.add('delete');
    await keys.save('anthropic', SECRET, CHECKED);
    storage.isRefusing = false;

    await expect(keys.forgetAll()).rejects.toThrow();
    os.refusing.delete('delete');
    expect(await keys.forgetAll()).toMatchObject({ unconfirmed: [] });
    expect(os.entries.size).toBe(0);
  });

  it('forget a key deleted from the keychain outside Mosaic', async () => {
    await keys.save('anthropic', SECRET, CHECKED);
    os.entries.clear();

    expect(await keys.read('anthropic')).toBeUndefined();
    expect(await keys.status()).toMatchObject({ saved: {} });
  });

  it('say so when the keychain holds a key but will not hand it over', async () => {
    await keys.save('anthropic', SECRET, CHECKED);
    os.refusing.add('get');

    await expect(keys.read('anthropic')).rejects.toBeInstanceOf(KeychainError);
  });

  it('take one change at a time', async () => {
    await keys.save('anthropic', SECRET, CHECKED);

    // Started together: the save waits for Forget to finish, so it survives it.
    const forgetting = keys.forgetAll();
    const saving = keys.save('openai', 'sk-openai', CHECKED);
    await Promise.all([forgetting, saving]);

    expect((await keys.status()).saved).toEqual({
      openai: { where: 'keychain', savedAt: 1_000, checkedAt: 1_000 },
    });
  });

  it('refuse changes while Erase holds them, and forget the one already in flight', async () => {
    let finishWrite = () => {};
    const set = os.keyring.set;
    const writing = new Promise<void>((started) => {
      os.keyring.set = async (account, secret) => {
        started();
        await new Promise<void>((resolve) => (finishWrite = resolve));
        await set(account, secret);
      };
    });
    const inFlight = keys.save('anthropic', SECRET, CHECKED);
    await writing;

    const release = keys.holdChanges();
    const forgetting = keys.forgetAll();
    const queued = keys.save('openai', 'sk-openai', CHECKED);
    finishWrite();

    await inFlight;
    await forgetting;
    await expect(queued).rejects.toThrow('Erase everything');
    await expect(keys.remove('anthropic')).rejects.toThrow('Erase everything');
    expect(os.entries.size).toBe(0);
    expect(await keys.status()).toMatchObject({ saved: {} });
    expect(() => keys.holdChanges()).toThrow('already running');

    release();
    os.keyring.set = set;
    await keys.save('openai', 'sk-openai', CHECKED);
    expect(os.entries.get('openai')).toBe('sk-openai');
  });
});
