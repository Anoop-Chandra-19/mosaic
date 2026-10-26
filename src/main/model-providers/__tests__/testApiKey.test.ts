import { describe, expect, it } from 'vitest';
import type { ModelListFetch } from '../listModels';
import { testApiKey } from '../testApiKey';

const KEY = 'sk-or-test-secret';

/** OpenRouter: its key endpoint answers `keyStatus`, its public list one tool model. */
function openRouter(keyStatus: number) {
  const sent: string[] = [];
  const fetch: ModelListFetch = async (url) => {
    sent.push(url);
    if (url.endsWith('/key')) return new Response(null, { status: keyStatus });
    return Response.json({ data: [{ id: 'openai/gpt-6-luna', supported_parameters: ['tools'] }] });
  };
  return { fetch, sent };
}

describe('testApiKey', () => {
  it('checks a key by listing the models it can use', async () => {
    const sent: string[] = [];
    const fetch: ModelListFetch = async (url) => {
      sent.push(url);
      return Response.json({ data: [{ id: 'gpt-6-luna' }] });
    };
    expect(await testApiKey('openai', 'sk-test', fetch)).toEqual({
      ok: true,
      models: ['gpt-6-luna'],
      hiddenCount: 0,
    });
    expect(sent).toEqual(['https://api.openai.com/v1/models']);
  });

  it('asks OpenRouter about the key first, since its model list is public', async () => {
    const working = openRouter(200);
    expect(await testApiKey('openrouter', KEY, working.fetch)).toMatchObject({
      ok: true,
      models: ['openai/gpt-6-luna'],
    });
    expect(working.sent).toEqual([
      'https://openrouter.ai/api/v1/key',
      'https://openrouter.ai/api/v1/models',
    ]);

    const refused = openRouter(401);
    expect(await testApiKey('openrouter', KEY, refused.fetch)).toEqual({
      ok: false,
      reason: 'refused',
      httpStatus: 401,
    });
    expect(refused.sent).toHaveLength(1);
  });
});
