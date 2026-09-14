import { describe, expect, it } from 'vitest';
import { listOllamaModels, OLLAMA_URL, type OllamaFetch } from '../ollamaModels';

// Shaped like a real Ollama 0.21 answer.
const TAGS = {
  models: [
    {
      name: 'qwen3.5:9b',
      size: 6_600_000_000,
      details: { family: 'qwen35', parameter_size: '9.7B' },
    },
    {
      name: 'nomic-embed-text:latest',
      size: 274_302_450,
      details: { family: 'nomic-bert', parameter_size: '137M' },
    },
    { name: 'gemma4:12b', size: 7_600_000_000, details: {} },
  ],
};

const CAPABILITIES: Record<string, unknown> = {
  'qwen3.5:9b': ['completion', 'tools', 'thinking', 'vision'],
  'nomic-embed-text:latest': ['embedding'],
  'gemma4:12b': ['completion', 'vision'],
};

/** An Ollama that answers `/api/tags` and `/api/show` from the tables above. */
function ollama(
  overrides: { tags?: () => Promise<Response>; show?: (model: string) => unknown } = {}
) {
  const fetch: OllamaFetch = async (url, init) => {
    if (url === `${OLLAMA_URL}/api/tags`) {
      return overrides.tags ? overrides.tags() : Response.json(TAGS);
    }
    if (url === `${OLLAMA_URL}/api/show` && init.method === 'POST') {
      const { model } = JSON.parse(init.body ?? '{}') as { model: string };
      const capabilities = overrides.show ? overrides.show(model) : CAPABILITIES[model];
      return Response.json({ capabilities });
    }
    return new Response(null, { status: 404 });
  };
  return fetch;
}

describe('listOllamaModels', () => {
  it('lists the chat models by name, leaving embedding models out', async () => {
    expect(await listOllamaModels(ollama())).toEqual({
      ok: true,
      models: [
        { name: 'gemma4:12b', sizeBytes: 7_600_000_000, parameterSize: null },
        { name: 'qwen3.5:9b', sizeBytes: 6_600_000_000, parameterSize: '9.7B' },
      ],
    });
  });

  it('keeps a model whose capabilities it cannot learn', async () => {
    const olderOllama = ollama({ show: () => undefined });
    const result = await listOllamaModels(olderOllama);
    expect(result.ok && result.models.map((m) => m.name)).toEqual([
      'gemma4:12b',
      'nomic-embed-text:latest',
      'qwen3.5:9b',
    ]);
  });

  it('says when nothing is listening, and when the answer makes no sense', async () => {
    const refused: OllamaFetch = () => Promise.reject(new TypeError('connect ECONNREFUSED'));
    expect(await listOllamaModels(refused)).toEqual({ ok: false, reason: 'not-running' });

    const broken = ollama({ tags: async () => new Response('<html>', { status: 200 }) });
    expect(await listOllamaModels(broken)).toEqual({ ok: false, reason: 'failed' });

    const erroring = ollama({ tags: async () => new Response(null, { status: 500 }) });
    expect(await listOllamaModels(erroring)).toEqual({ ok: false, reason: 'failed' });
  });

  it('answers with an empty list when nothing is pulled', async () => {
    const empty = ollama({ tags: async () => Response.json({ models: [] }) });
    expect(await listOllamaModels(empty)).toEqual({ ok: true, models: [] });
  });
});
