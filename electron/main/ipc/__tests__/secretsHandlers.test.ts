import { beforeEach, describe, expect, it } from 'vitest';
import type { KeyTest } from '@/types/secrets';
import { createApiKeys } from '../../secrets/apiKeys';
import { fakeKeyring, memoryStorage } from '../../secrets/__tests__/fakeKeyring';
import { createSecretsHandlers, type SecretsHandlers } from '../secretsHandlers';

const SECRET = 'sk-ant-secret-value';

let os: ReturnType<typeof fakeKeyring>;
let tested: { provider: string; key: string; model: string }[];
let handlers: SecretsHandlers;

beforeEach(() => {
  os = fakeKeyring();
  tested = [];
  handlers = createSecretsHandlers(
    createApiKeys(os.keyring, memoryStorage()),
    async (provider, key, model): Promise<KeyTest> => {
      tested.push({ provider, key, model });
      return { ok: true, modelFound: true };
    }
  );
});

describe('secrets handlers', () => {
  it('check every argument, and never quote a refused key', async () => {
    const refusals: [keyof SecretsHandlers, ...unknown[]][] = [
      ['save', 'ollama', SECRET],
      ['save', 'acme', SECRET],
      ['save', 'anthropic', ''],
      ['save', 'anthropic', '   '],
      ['save', 'anthropic', `${SECRET} extra`],
      ['save', 'anthropic', `${SECRET}\n`.repeat(2)],
      ['save', 'anthropic', 'k'.repeat(4097)],
      ['save', 'anthropic', 42],
      ['remove', 'ollama'],
      ['setLocation', 'disk'],
      ['test', 'anthropic', '', SECRET],
      ['test', 'anthropic', 'claude', 7],
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

  it('save a key trimmed of the whitespace a paste brings along', async () => {
    await handlers.save('anthropic', `  ${SECRET}\n`);
    expect(os.entries.get('anthropic')).toBe(SECRET);
  });

  it('test a typed key, or else the saved one', async () => {
    await handlers.test('openai', 'gpt-4.1-mini', 'sk-typed');
    await handlers.save('anthropic', SECRET);
    await handlers.test('anthropic', ' claude-sonnet ', null);

    expect(tested).toEqual([
      { provider: 'openai', key: 'sk-typed', model: 'gpt-4.1-mini' },
      { provider: 'anthropic', key: SECRET, model: 'claude-sonnet' },
    ]);
  });

  it('answer a test with no key to test, or one the keychain keeps to itself', async () => {
    expect(await handlers.test('gemini', 'gemini-2.0-flash')).toEqual({
      ok: false,
      reason: 'no-key',
    });

    await handlers.save('anthropic', SECRET);
    os.refusing.add('get');
    expect(await handlers.test('anthropic', 'claude-sonnet')).toEqual({
      ok: false,
      reason: 'keychain',
    });
    expect(tested).toEqual([]);
  });
});
