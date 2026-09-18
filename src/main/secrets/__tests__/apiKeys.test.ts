import { beforeEach, describe, expect, it } from 'vitest';
import { createApiKeys, KeychainError, type ApiKeys } from '../apiKeys';
import { fakeKeyring, memoryStorage } from './fakeKeyring';

let os: ReturnType<typeof fakeKeyring>;
let storage: ReturnType<typeof memoryStorage>;
let keys: ApiKeys;

const SECRET = 'sk-ant-secret-value';

beforeEach(() => {
  os = fakeKeyring();
  storage = memoryStorage();
  keys = createApiKeys(os.keyring, storage);
});

describe('API keys', () => {
  it('go to the keychain by default, and the settings note names the provider only', async () => {
    const status = await keys.save('anthropic', SECRET);

    expect(status).toEqual({
      location: 'keychain',
      keychain: 'available',
      saved: { anthropic: 'keychain' },
    });
    expect(os.entries.get('anthropic')).toBe(SECRET);
    expect(storage.value).not.toContain(SECRET);
    expect(JSON.parse(storage.value!)).toEqual({ location: 'keychain', keychain: ['anthropic'] });
    expect(await keys.read('anthropic')).toBe(SECRET);
  });

  it('report their status without touching the keychain', async () => {
    await keys.save('openai', SECRET);
    os.calls.length = 0;

    // A fresh launch over the same settings: the note is enough.
    const relaunched = createApiKeys(os.keyring, storage);
    expect(await relaunched.status()).toEqual({
      location: 'keychain',
      keychain: 'unknown',
      saved: { openai: 'keychain' },
    });
    expect(os.calls).toEqual([]);
  });

  it('stay for the session when the keychain refuses, and stop asking it', async () => {
    os.refusing.add('set');

    const status = await keys.save('anthropic', SECRET);
    expect(status).toEqual({
      location: 'session',
      keychain: 'unavailable',
      saved: { anthropic: 'session' },
    });
    expect(await keys.read('anthropic')).toBe(SECRET);

    os.calls.length = 0;
    await keys.save('openai', 'sk-other');
    expect(os.calls).toEqual([]);
    // The choice is kept: a later launch tries the keychain again.
    expect(JSON.parse(storage.value ?? '{"location":"keychain"}').location).toBe('keychain');
  });

  it('move between the keychain and the session, both ways', async () => {
    await keys.save('anthropic', SECRET);

    const toSession = await keys.setLocation('session');
    expect(toSession).toMatchObject({ location: 'session', saved: { anthropic: 'session' } });
    expect(os.entries.size).toBe(0);
    expect(await keys.read('anthropic')).toBe(SECRET);

    const back = await keys.setLocation('keychain');
    expect(back).toMatchObject({ location: 'keychain', saved: { anthropic: 'keychain' } });
    expect(os.entries.get('anthropic')).toBe(SECRET);
  });

  it('stay put when the keychain will not give a key back for the move', async () => {
    await keys.save('anthropic', SECRET);
    os.refusing.add('get');

    await expect(keys.setLocation('session')).rejects.toThrow();
    expect(os.entries.get('anthropic')).toBe(SECRET);
    expect(await keys.status()).toMatchObject({
      location: 'keychain',
      saved: { anthropic: 'keychain' },
    });
  });

  it('saved for the session replace an older keychain copy', async () => {
    await keys.save('anthropic', 'sk-old');
    await keys.setLocation('session');
    await keys.setLocation('keychain');
    os.refusing.add('set');

    await keys.save('anthropic', SECRET);

    expect(os.entries.has('anthropic')).toBe(false);
    expect(await keys.read('anthropic')).toBe(SECRET);
    expect(await keys.status()).toMatchObject({ saved: { anthropic: 'session' } });
  });

  it('are removed from wherever they are', async () => {
    await keys.save('anthropic', SECRET);
    await keys.setLocation('session');
    await keys.setLocation('keychain');
    await keys.save('openai', 'sk-openai');

    await keys.remove('anthropic');
    await keys.remove('openai');

    expect(os.entries.size).toBe(0);
    expect(await keys.status()).toMatchObject({ saved: {} });
    expect(await keys.read('anthropic')).toBeUndefined();
  });

  it('are all forgotten, including keychain entries Mosaic has no note of', async () => {
    await keys.save('anthropic', SECRET);
    os.entries.set('gemini', 'left by an earlier install');
    os.refusing.add('set');
    await keys.save('openai', 'sk-session');

    expect(await keys.forgetAll()).toMatchObject({ saved: {} });
    expect(os.entries.size).toBe(0);
    expect(await keys.read('openai')).toBeUndefined();
  });

  it('are not reported forgotten while the keychain still holds one on record', async () => {
    await keys.save('anthropic', SECRET);
    os.refusing.add('delete');

    await expect(keys.forgetAll()).rejects.toThrow();
    expect(await keys.status()).toMatchObject({ saved: { anthropic: 'keychain' } });
  });

  it('forget a key deleted from the keychain outside Mosaic', async () => {
    await keys.save('anthropic', SECRET);
    os.entries.clear();

    expect(await keys.read('anthropic')).toBeUndefined();
    expect(await keys.status()).toMatchObject({ saved: {} });
  });

  it('say so when the keychain holds a key but will not hand it over', async () => {
    await keys.save('anthropic', SECRET);
    os.refusing.add('get');

    await expect(keys.read('anthropic')).rejects.toBeInstanceOf(KeychainError);
  });

  it('take one change at a time', async () => {
    await keys.save('anthropic', SECRET);

    // Started together: the save waits for the move to finish, so it lands in the session.
    const moving = keys.setLocation('session');
    const saving = keys.save('openai', 'sk-openai');
    await Promise.all([moving, saving]);

    expect(await keys.status()).toMatchObject({
      location: 'session',
      saved: { anthropic: 'session', openai: 'session' },
    });
    expect(os.entries.size).toBe(0);
  });
});
