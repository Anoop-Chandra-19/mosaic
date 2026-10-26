import { beforeEach, describe, expect, it } from 'vitest';
import type { KeyTest } from '../../model-providers/testApiKey';
import { createApiKeys } from '../../secrets/apiKeys';
import { fakeKeyring, memoryStorage } from '../../secrets/__tests__/fakeKeyring';
import { createSecretsHandlers, type SecretsHandlers } from '../secretsHandlers';

const SECRET = 'sk-ant-secret-value';
const MODEL = 'claude-sonnet-5';
const CHECK = { model: MODEL, check: true, forgetOnClose: false };

let os: ReturnType<typeof fakeKeyring>;
let tested: { provider: string; key: string; model: string }[];
let answer: KeyTest;
let handlers: SecretsHandlers;

beforeEach(() => {
  os = fakeKeyring();
  tested = [];
  answer = { ok: true, modelFound: true };
  handlers = createSecretsHandlers(
    createApiKeys(os.keyring, memoryStorage(), () => 1_000),
    async (provider, key, model) => {
      tested.push({ provider, key, model });
      return answer;
    }
  );
});

describe('secrets handlers', () => {
  it('check every argument, and never quote a refused key', async () => {
    const refusals: [keyof SecretsHandlers, ...unknown[]][] = [
      ['save', 'ollama', SECRET, CHECK],
      ['save', 'acme', SECRET, CHECK],
      ['save', 'anthropic', '', CHECK],
      ['save', 'anthropic', '   ', CHECK],
      ['save', 'anthropic', `${SECRET} extra`, CHECK],
      ['save', 'anthropic', `${SECRET}\n`.repeat(2), CHECK],
      ['save', 'anthropic', 'k'.repeat(4097), CHECK],
      ['save', 'anthropic', 42, CHECK],
      ['save', 'anthropic', SECRET, null],
      ['save', 'anthropic', SECRET, { ...CHECK, check: 'yes' }],
      ['save', 'anthropic', SECRET, { ...CHECK, model: '' }],
      ['check', 'anthropic', 7],
      ['remove', 'ollama'],
    ];
    for (const [method, ...args] of refusals) {
      const call = async () => (handlers[method] as (...a: unknown[]) => unknown)(...args);
      const error = await call().then(
        () => undefined,
        (e: unknown) => e as Error
      );
      expect(error, `${method}(${JSON.stringify(args).slice(0, 60)})`).toBeInstanceOf(Error);
      expect(error?.message).not.toContain(SECRET);
    }
    expect(os.entries.size).toBe(0);
  });

  it('check a key with the provider before keeping it, trimmed of what a paste brings', async () => {
    expect(await handlers.save('anthropic', `  ${SECRET}\n`, CHECK)).toEqual({
      ok: true,
      status: {
        keychain: 'available',
        saved: { anthropic: { where: 'keychain', savedAt: 1_000, checkedAt: 1_000 } },
      },
      modelFound: true,
    });
    expect(tested).toEqual([{ provider: 'anthropic', key: SECRET, model: MODEL }]);
    expect(os.entries.get('anthropic')).toBe(SECRET);
  });

  it('keep nothing new when the check fails, and leave a saved key in place', async () => {
    await handlers.save('anthropic', 'sk-ant-working', CHECK);
    answer = { ok: false, reason: 'refused', httpStatus: 401 };

    expect(await handlers.save('anthropic', SECRET, CHECK)).toEqual(answer);
    expect(os.entries.get('anthropic')).toBe('sk-ant-working');
  });

  it('save without checking only when asked', async () => {
    const saved = await handlers.save('openai', 'sk-offline', { ...CHECK, check: false });

    expect(saved).toMatchObject({ ok: true, modelFound: null });
    expect(tested).toEqual([]);
    expect(await handlers.status()).toMatchObject({ saved: { openai: { checkedAt: null } } });
  });

  it('check a saved key again, and note when it passes', async () => {
    await handlers.save('openai', 'sk-saved', { ...CHECK, check: false });

    answer = { ok: false, reason: 'unreachable' };
    expect(await handlers.check('openai', MODEL)).toEqual(answer);
    expect(await handlers.status()).toMatchObject({ saved: { openai: { checkedAt: null } } });

    answer = { ok: true, modelFound: false };
    expect(await handlers.check('openai', ` ${MODEL} `)).toMatchObject({
      ok: true,
      status: { saved: { openai: { checkedAt: 1_000 } } },
      modelFound: false,
    });
    expect(tested.at(-1)).toEqual({ provider: 'openai', key: 'sk-saved', model: MODEL });
  });

  it('answer a check with no key to check, or one the keychain keeps to itself', async () => {
    expect(await handlers.check('gemini', 'gemini-3.8-flash')).toEqual({
      ok: false,
      reason: 'no-key',
    });

    await handlers.save('anthropic', SECRET, CHECK);
    tested = [];
    os.refusing.add('get');
    expect(await handlers.check('anthropic', MODEL)).toEqual({ ok: false, reason: 'keychain' });
    expect(tested).toEqual([]);
  });
});
