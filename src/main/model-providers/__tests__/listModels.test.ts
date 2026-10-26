import { describe, expect, it } from 'vitest';
import { KEYED_PROVIDERS } from '@shared/types/secrets';
import { listModels, type ModelListFetch } from '../listModels';

const KEY = 'sk-test-secret';

/** A provider that answers each URL from `pages`, in order, and remembers what it was sent. */
function provider(...pages: unknown[]) {
  const sent: { url: string; headers: Record<string, string> }[] = [];
  const fetch: ModelListFetch = async (url, { headers }) => {
    sent.push({ url, headers });
    return Response.json(pages[sent.length - 1] ?? {});
  };
  return { fetch, sent };
}

describe('listModels', () => {
  it('keeps OpenAI’s chat models, newest first, and counts the rest', async () => {
    const { fetch, sent } = provider({
      data: [
        { id: 'gpt-5.6-terra', created: 300 },
        { id: 'text-embedding-3-large', created: 500 },
        { id: 'gpt-6-luna', created: 400 },
        { id: 'whisper-1', created: 100 },
        { id: 'gpt-image-2', created: 450 },
        { id: 'o5-mini', created: 200 },
      ],
    });

    expect(await listModels('openai', KEY, fetch)).toEqual({
      ok: true,
      models: ['gpt-6-luna', 'gpt-5.6-terra', 'o5-mini'],
      hiddenCount: 3,
    });
    expect(sent[0]).toEqual({
      url: 'https://api.openai.com/v1/models',
      headers: { Authorization: `Bearer ${KEY}` },
    });
  });

  it('follows Anthropic’s pages', async () => {
    const { fetch, sent } = provider(
      {
        data: [{ id: 'claude-opus-5', created_at: '2026-08-01T00:00:00Z' }],
        has_more: true,
        last_id: 'claude-opus-5',
      },
      {
        data: [{ id: 'claude-sonnet-5', created_at: '2026-09-01T00:00:00Z' }],
        has_more: false,
        last_id: 'claude-sonnet-5',
      }
    );

    expect(await listModels('anthropic', KEY, fetch)).toEqual({
      ok: true,
      models: ['claude-sonnet-5', 'claude-opus-5'],
      hiddenCount: 0,
    });
    expect(sent.map((s) => s.url)).toEqual([
      'https://api.anthropic.com/v1/models?limit=1000',
      'https://api.anthropic.com/v1/models?limit=1000&after_id=claude-opus-5',
    ]);
  });

  it('keeps Gemini’s text models that generate content, through its pages', async () => {
    const { fetch, sent } = provider(
      {
        models: [
          { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-embedding-2', supportedGenerationMethods: ['embedContent'] },
        ],
        nextPageToken: 'page-2',
      },
      {
        models: [
          { name: 'models/gemini-3.8-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/imagen-5', supportedGenerationMethods: ['predict'] },
        ],
      }
    );

    expect(await listModels('gemini', KEY, fetch)).toEqual({
      ok: true,
      models: ['gemini-3.8-flash', 'gemini-3.8-pro'],
      hiddenCount: 3,
    });
    expect(sent[1].url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken=page-2'
    );
  });

  it('keeps only OpenRouter’s models that can call tools', async () => {
    const { fetch } = provider({
      data: [
        { id: 'anthropic/claude-sonnet-5', created: 2, supported_parameters: ['tools'] },
        { id: 'acme/story-teller', created: 3, supported_parameters: ['temperature'] },
        { id: 'openai/gpt-6-luna', created: 1, supported_parameters: ['tools', 'reasoning'] },
      ],
    });

    expect(await listModels('openrouter', KEY, fetch)).toEqual({
      ok: true,
      models: ['anthropic/claude-sonnet-5', 'openai/gpt-6-luna'],
      hiddenCount: 1,
    });
  });

  it('sorts a refused key, other errors, no answer, and an answer that isn’t a list', async () => {
    const answering =
      (status: number, body = ''): ModelListFetch =>
      async () =>
        new Response(body || null, { status });

    expect(await listModels('openai', KEY, answering(401))).toEqual({
      ok: false,
      reason: 'refused',
      httpStatus: 401,
    });
    expect(
      await listModels(
        'gemini',
        KEY,
        answering(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}')
      )
    ).toMatchObject({ ok: false, reason: 'refused' });
    expect(await listModels('anthropic', KEY, answering(529))).toEqual({
      ok: false,
      reason: 'failed',
      httpStatus: 529,
    });
    expect(await listModels('openai', KEY, () => Promise.reject(new TypeError('offline')))).toEqual(
      { ok: false, reason: 'unreachable' }
    );
    expect(await listModels('openai', KEY, answering(200, '{"data":"none"}'))).toEqual({
      ok: false,
      reason: 'failed',
      httpStatus: 200,
    });
  });

  it('sends the key in a header, never in the URL', async () => {
    for (const keyed of KEYED_PROVIDERS) {
      const { fetch, sent } = provider({ data: [], models: [] });
      await listModels(keyed, KEY, fetch);
      expect(sent[0].url, keyed).not.toContain(KEY);
      expect(Object.values(sent[0].headers).join(' '), keyed).toContain(KEY);
    }
  });
});
