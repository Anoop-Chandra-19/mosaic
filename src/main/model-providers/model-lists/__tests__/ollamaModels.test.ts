import { describe, expect, it } from 'vitest';
import { listOllamaModels, type OllamaFetch } from '../ollamaModels';

// An Ollama on the network, as someone with a GPU box would set it.
const OLLAMA_URL = 'http://192.168.1.50:11434';

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

const SHOW: Record<string, unknown> = {
  'qwen3.5:9b': {
    capabilities: ['completion', 'tools', 'thinking', 'vision'],
    model_info: { 'qwen35.context_length': 262_144 },
  },
  'nomic-embed-text:latest': { capabilities: ['embedding'] },
  'gemma4:12b': { capabilities: ['completion', 'vision'] },
};

// Shaped like a real Ollama 0.40 answer: qwen is loaded, with a smaller window than it supports.
const PS = { models: [{ name: 'qwen3.5:9b', context_length: 32_768 }] };

/** An Ollama that answers `/api/tags`, `/api/show` and `/api/ps` from the tables above. */
function ollama(
  overrides: {
    tags?: () => Promise<Response>;
    show?: (model: string) => unknown;
    ps?: () => Promise<Response>;
  } = {}
) {
  const fetch: OllamaFetch = async (url, init) => {
    if (url === `${OLLAMA_URL}/api/tags`) {
      return overrides.tags ? overrides.tags() : Response.json(TAGS);
    }
    if (url === `${OLLAMA_URL}/api/show` && init.method === 'POST') {
      const { model } = JSON.parse(init.body ?? '{}') as { model: string };
      return Response.json(overrides.show ? overrides.show(model) : SHOW[model]);
    }
    if (url === `${OLLAMA_URL}/api/ps`) {
      return overrides.ps ? overrides.ps() : Response.json(PS);
    }
    return new Response(null, { status: 404 });
  };
  return fetch;
}

describe('listOllamaModels', () => {
  it('lists the chat models by name, leaving embedding models out', async () => {
    expect(await listOllamaModels(ollama(), OLLAMA_URL)).toEqual({
      ok: true,
      models: [
        {
          name: 'gemma4:12b',
          sizeBytes: 7_600_000_000,
          parameterSize: null,
          maxContextTokens: null,
          loadedContextTokens: null,
        },
        {
          name: 'qwen3.5:9b',
          sizeBytes: 6_600_000_000,
          parameterSize: '9.7B',
          maxContextTokens: 262_144,
          loadedContextTokens: 32_768,
        },
      ],
    });
  });

  it('still lists the models when Ollama won’t say what is loaded', async () => {
    const olderOllama = ollama({ ps: async () => new Response(null, { status: 404 }) });
    const result = await listOllamaModels(olderOllama, OLLAMA_URL);
    expect(result.ok && result.models.map((m) => m.loadedContextTokens)).toEqual([null, null]);
  });

  it('keeps a model whose capabilities it cannot learn', async () => {
    const olderOllama = ollama({ show: () => undefined });
    const result = await listOllamaModels(olderOllama, OLLAMA_URL);
    expect(result.ok && result.models.map((m) => m.name)).toEqual([
      'gemma4:12b',
      'nomic-embed-text:latest',
      'qwen3.5:9b',
    ]);
  });

  it('says when nothing is listening, and when the answer makes no sense', async () => {
    const refused: OllamaFetch = () => Promise.reject(new TypeError('connect ECONNREFUSED'));
    expect(await listOllamaModels(refused, OLLAMA_URL)).toEqual({
      ok: false,
      reason: 'unreachable',
    });

    const broken = ollama({ tags: async () => new Response('<html>', { status: 200 }) });
    expect(await listOllamaModels(broken, OLLAMA_URL)).toEqual({ ok: false, reason: 'failed' });

    const erroring = ollama({ tags: async () => new Response(null, { status: 500 }) });
    expect(await listOllamaModels(erroring, OLLAMA_URL)).toEqual({ ok: false, reason: 'failed' });
  });

  it('answers with an empty list when nothing is pulled', async () => {
    const empty = ollama({ tags: async () => Response.json({ models: [] }) });
    expect(await listOllamaModels(empty, OLLAMA_URL)).toEqual({ ok: true, models: [] });
  });

  it('asks the address given, filled in the way the settings row fills it', async () => {
    const asked: string[] = [];
    const recording: OllamaFetch = async (url, init) => {
      asked.push(url);
      return ollama()(url, init);
    };
    await listOllamaModels(recording, '192.168.1.50');
    expect(asked[0]).toBe(`${OLLAMA_URL}/api/tags`);
    expect(new Set(asked.slice(1))).toEqual(
      new Set([`${OLLAMA_URL}/api/show`, `${OLLAMA_URL}/api/ps`])
    );
  });

  it('sends nothing to an address that is not one', async () => {
    const asked: string[] = [];
    const recording: OllamaFetch = async (url) => {
      asked.push(url);
      return new Response(null, { status: 500 });
    };
    for (const address of ['file:///etc/passwd', 'http://user:pw@host', '', 42, undefined]) {
      expect(await listOllamaModels(recording, address)).toEqual({
        ok: false,
        reason: 'invalid-address',
      });
    }
    expect(asked).toEqual([]);
  });
});
