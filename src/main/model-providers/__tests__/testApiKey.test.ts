import { describe, expect, it } from 'vitest';
import { KEYED_PROVIDERS } from '@shared/types/secrets';
import { testApiKey, type KeyTestFetch } from '../testApiKey';

const KEY = 'sk-test-secret';

/** A provider that answers every request with `status`, and remembers what it was sent. */
function answering(status: number, body = '') {
  const sent: { url: string; headers: Record<string, string> }[] = [];
  const fetch: KeyTestFetch = async (url, { headers }) => {
    sent.push({ url, headers });
    return new Response(body || null, { status });
  };
  return { fetch, sent };
}

describe('testApiKey', () => {
  it('looks the model up, so a working key also says whether it reaches the model', async () => {
    const found = answering(200);
    expect(await testApiKey('openai', KEY, 'gpt-4.1-mini', found.fetch)).toEqual({
      ok: true,
      modelFound: true,
    });
    expect(found.sent[0].url).toBe('https://api.openai.com/v1/models/gpt-4.1-mini');

    const missing = answering(404);
    expect(await testApiKey('anthropic', KEY, 'claude-nope', missing.fetch)).toEqual({
      ok: true,
      modelFound: false,
    });
  });

  it('asks OpenRouter about the key itself, since its model list is public', async () => {
    const { fetch, sent } = answering(200);
    expect(await testApiKey('openrouter', KEY, 'openai/gpt-4o-mini', fetch)).toEqual({
      ok: true,
      modelFound: null,
    });
    expect(sent[0].url).toBe('https://openrouter.ai/api/v1/key');
    // Its 404 is an error, not a missing model.
    expect(await testApiKey('openrouter', KEY, 'x', answering(404).fetch)).toEqual({
      ok: false,
      reason: 'failed',
      httpStatus: 404,
    });
  });

  it('reports a refused key', async () => {
    for (const status of [401, 403]) {
      expect(await testApiKey('openai', KEY, 'gpt-4.1-mini', answering(status).fetch)).toEqual({
        ok: false,
        reason: 'refused',
        httpStatus: status,
      });
    }
    const gemini = answering(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}');
    expect(await testApiKey('gemini', KEY, 'gemini-2.0-flash', gemini.fetch)).toMatchObject({
      ok: false,
      reason: 'refused',
    });
  });

  it('reports other errors with their status, and no answer as unreachable', async () => {
    expect(await testApiKey('anthropic', KEY, 'm', answering(500).fetch)).toEqual({
      ok: false,
      reason: 'failed',
      httpStatus: 500,
    });
    expect(await testApiKey('gemini', KEY, 'm', answering(400, '{"error":"bad"}').fetch)).toEqual({
      ok: false,
      reason: 'failed',
      httpStatus: 400,
    });
    const offline: KeyTestFetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await testApiKey('openai', KEY, 'gpt-4.1-mini', offline)).toEqual({
      ok: false,
      reason: 'unreachable',
    });
  });

  it('sends the key in a header, never in the URL', async () => {
    for (const provider of KEYED_PROVIDERS) {
      const { fetch, sent } = answering(200);
      await testApiKey(provider, KEY, 'models/some-model', fetch);
      expect(sent[0].url, provider).not.toContain(KEY);
      expect(Object.values(sent[0].headers).join(' '), provider).toContain(KEY);
    }
  });

  it('names the model safely in the URL', async () => {
    const { fetch, sent } = answering(200);
    await testApiKey('gemini', KEY, 'models/gemini-2.0-flash', fetch);
    await testApiKey('openai', KEY, 'ft:gpt-4o:acme::abc/../x', fetch);
    expect(sent.map((s) => s.url)).toEqual([
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash',
      'https://api.openai.com/v1/models/ft%3Agpt-4o%3Aacme%3A%3Aabc%2F..%2Fx',
    ]);
  });
});
