import { beforeEach, describe, expect, it } from 'vitest';
import type { KeyTest } from '../../model-providers/model-lists/testApiKey';
import { createApiKeys } from '../../secrets/apiKeys';
import { fakeKeyring, memoryStorage } from '../../secrets/__tests__/fakeKeyring';
import { createSecretsHandlers, type SecretsHandlers } from '../secretsHandlers';

const SECRET = 'sk-ant-secret-value';
const MODEL = 'claude-sonnet-5';
const CHECK = { check: true, forgetOnClose: false };

let os: ReturnType<typeof fakeKeyring>;
let tested: { provider: string; key: string }[];
let answer: KeyTest;
let clock: number;
let handlers: SecretsHandlers;

beforeEach(() => {
  os = fakeKeyring();
  tested = [];
  answer = { ok: true, models: [MODEL, 'claude-opus-5'], hiddenCount: 0 };
  clock = 1_000;
  handlers = createSecretsHandlers(
    createApiKeys(os.keyring, memoryStorage(), () => clock),
    async (provider, key) => {
      tested.push({ provider, key });
      return answer;
    },
    () => clock
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
      ['check', 'acme'],
      ['listModels', 'ollama', false],
      ['listModels', 'anthropic', 'yes'],
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
    });
    expect(tested).toEqual([{ provider: 'anthropic', key: SECRET }]);
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

    expect(saved).toMatchObject({ ok: true });
    expect(tested).toEqual([]);
    expect(await handlers.status()).toMatchObject({ saved: { openai: { checkedAt: null } } });
  });

  it('check a saved key again, and note when it passes', async () => {
    await handlers.save('openai', 'sk-saved', { ...CHECK, check: false });

    answer = { ok: false, reason: 'unreachable' };
    expect(await handlers.check('openai')).toEqual(answer);
    expect(await handlers.status()).toMatchObject({ saved: { openai: { checkedAt: null } } });

    answer = { ok: true, models: ['gpt-6-luna'], hiddenCount: 4 };
    expect(await handlers.check('openai')).toMatchObject({
      ok: true,
      status: { saved: { openai: { checkedAt: 1_000 } } },
    });
    expect(tested.at(-1)).toEqual({ provider: 'openai', key: 'sk-saved' });
  });

  it('answer a check with no key to check, or one the keychain keeps to itself', async () => {
    expect(await handlers.check('google')).toEqual({
      ok: false,
      reason: 'no-key',
    });

    await handlers.save('anthropic', SECRET, CHECK);
    tested = [];
    os.refusing.add('get');
    expect(await handlers.check('anthropic')).toEqual({ ok: false, reason: 'keychain' });
    expect(tested).toEqual([]);
  });
});

describe('model lists', () => {
  it('keep the list a check made, answered without asking the keychain again', async () => {
    await handlers.save('anthropic', SECRET, CHECK);
    tested = [];
    os.calls.length = 0;
    clock = 9_000;

    expect(await handlers.listModels('anthropic', false)).toEqual({
      ok: true,
      list: { models: [MODEL, 'claude-opus-5'], hiddenCount: 0, listedAt: 1_000 },
    });
    expect(tested).toEqual([]);
    expect(os.calls).toEqual([]);
  });

  it('ask the provider again on refresh, or once a new key is saved', async () => {
    await handlers.save('anthropic', SECRET, CHECK);
    clock = 2_000;
    answer = { ok: true, models: ['claude-haiku-5'], hiddenCount: 0 };
    expect(await handlers.listModels('anthropic', true)).toMatchObject({
      list: { models: ['claude-haiku-5'], listedAt: 2_000 },
    });

    await handlers.save('anthropic', 'sk-ant-newer', { ...CHECK, check: false });
    clock = 3_000;
    expect(await handlers.listModels('anthropic', false)).toMatchObject({
      list: { listedAt: 3_000 },
    });
    expect(tested.at(-1)).toEqual({ provider: 'anthropic', key: 'sk-ant-newer' });
  });

  it('say why there is no list', async () => {
    expect(await handlers.listModels('openai', false)).toEqual({ ok: false, reason: 'no-key' });

    await handlers.save('anthropic', SECRET, CHECK);
    await handlers.remove('anthropic');
    expect(await handlers.listModels('anthropic', false)).toEqual({
      ok: false,
      reason: 'no-key',
    });

    await handlers.save('openai', 'sk-saved', { ...CHECK, check: false });
    answer = { ok: false, reason: 'failed', httpStatus: 503 };
    expect(await handlers.listModels('openai', false)).toEqual(answer);
  });
});
