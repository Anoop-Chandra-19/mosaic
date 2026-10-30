import { describe, expect, it, vi } from 'vitest';
import {
  listOpenAiCompatibleModels,
  type OpenAiCompatibleModelsFetch,
} from '../openAiCompatibleModels';

const answering = (body: unknown, status = 200): OpenAiCompatibleModelsFetch =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('listOpenAiCompatibleModels', () => {
  it('lists the server’s models by name, with a pasted /v1 dropped from the address', async () => {
    const fetch = answering({
      object: 'list',
      data: [{ id: 'qwen3.5-9b' }, { id: 'granite-4' }, { id: '' }, {}],
    });
    expect(await listOpenAiCompatibleModels(fetch, '127.0.0.1:1234/v1')).toEqual({
      ok: true,
      models: ['granite-4', 'qwen3.5-9b'],
    });
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/models', expect.anything());
  });

  it('says what went wrong, and never fetches an address that isn’t one', async () => {
    const fetch = answering({ data: [] });
    for (const address of ['file:///etc/passwd', 42]) {
      expect(await listOpenAiCompatibleModels(fetch, address)).toEqual({
        ok: false,
        reason: 'invalid-address',
      });
    }
    expect(fetch).not.toHaveBeenCalled();

    const refused = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await listOpenAiCompatibleModels(refused, 'localhost')).toEqual({
      ok: false,
      reason: 'unreachable',
    });
    for (const failing of [answering({ data: [] }, 500), answering({ models: [] })]) {
      expect(await listOpenAiCompatibleModels(failing, 'localhost')).toEqual({
        ok: false,
        reason: 'failed',
      });
    }
  });
});
