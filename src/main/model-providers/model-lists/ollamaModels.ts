import { normalizeOllamaAddress } from '@shared/model-providers/serverAddress';
import type { OllamaModel, OllamaModels } from '@shared/types/modelProviders';
import { SERVER_MODELS_TIMEOUT_MS } from '../providerEndpoints';

/** `fetch`, narrowed to what these calls send. Main passes Electron's `net.fetch`. */
export type OllamaFetch = (
  url: string,
  init: { method?: 'POST'; body?: string; signal: AbortSignal }
) => Promise<Response>;

type PulledModel = Pick<OllamaModel, 'name' | 'sizeBytes' | 'parameterSize'>;

interface ModelDetails {
  canChat: boolean;
  maxContextTokens: number | null;
}

function parseTags(body: unknown): PulledModel[] {
  const listed = (body as { models?: unknown } | null)?.models;
  if (!Array.isArray(listed)) throw new Error('No model list in the answer');
  return listed.flatMap((entry: unknown) => {
    const model = entry as {
      name?: unknown;
      size?: unknown;
      details?: { parameter_size?: unknown };
    } | null;
    if (typeof model?.name !== 'string' || model.name === '') return [];
    return [
      {
        name: model.name,
        sizeBytes: typeof model.size === 'number' ? model.size : 0,
        parameterSize:
          typeof model.details?.parameter_size === 'string' ? model.details.parameter_size : null,
      },
    ];
  });
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

/**
 * What `/api/show` says about a model. Ollama lists embedding models alongside chat ones, and
 * only this says which is which. An older Ollama without capabilities, or a lookup that
 * fails, keeps the model — better offered than hidden.
 */
async function readModelDetails(
  fetch: OllamaFetch,
  address: string,
  name: string
): Promise<ModelDetails> {
  try {
    const response = await fetch(`${address}/api/show`, {
      method: 'POST',
      body: JSON.stringify({ model: name }),
      signal: AbortSignal.timeout(SERVER_MODELS_TIMEOUT_MS),
    });
    const { capabilities, model_info: modelInfo = {} } = (await response.json()) as {
      capabilities?: unknown;
      model_info?: Record<string, unknown>;
    };
    // Keyed by the model's architecture: `qwen35.context_length`.
    const contextKey = Object.keys(modelInfo).find((key) => key.endsWith('.context_length'));
    return {
      canChat: !Array.isArray(capabilities) || capabilities.includes('completion'),
      maxContextTokens: contextKey ? readPositiveNumber(modelInfo[contextKey]) : null,
    };
  } catch {
    return { canChat: true, maxContextTokens: null };
  }
}

/** The window of each model Ollama has loaded now, from `/api/ps`. Empty if it won't say. */
async function readLoadedContextTokens(
  fetch: OllamaFetch,
  address: string
): Promise<Map<string, number>> {
  const loaded = new Map<string, number>();
  try {
    const response = await fetch(`${address}/api/ps`, {
      signal: AbortSignal.timeout(SERVER_MODELS_TIMEOUT_MS),
    });
    const { models } = (await response.json()) as {
      models?: { name?: unknown; context_length?: unknown }[];
    };
    for (const model of models ?? []) {
      const tokens = readPositiveNumber(model.context_length);
      if (typeof model.name === 'string' && tokens !== null) loaded.set(model.name, tokens);
    }
  } catch {
    // An older Ollama: nothing to say about what is loaded.
  }
  return loaded;
}

/**
 * The chat models pulled into the Ollama at `address`, by name. The address arrives from the
 * renderer, so it is checked again here: only an http(s) origin is ever fetched. Never throws.
 */
export async function listOllamaModels(
  fetch: OllamaFetch,
  requestedAddress: unknown
): Promise<OllamaModels> {
  const address =
    typeof requestedAddress === 'string' ? normalizeOllamaAddress(requestedAddress) : null;
  if (address === null) return { ok: false, reason: 'invalid-address' };

  let response: Response;
  try {
    response = await fetch(`${address}/api/tags`, {
      signal: AbortSignal.timeout(SERVER_MODELS_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  let pulled: PulledModel[];
  try {
    if (!response.ok) throw new Error(`Ollama answered ${response.status}`);
    pulled = parseTags(await response.json());
  } catch {
    return { ok: false, reason: 'failed' };
  }

  const [details, loaded] = await Promise.all([
    Promise.all(pulled.map((model) => readModelDetails(fetch, address, model.name))),
    readLoadedContextTokens(fetch, address),
  ]);
  const models = pulled
    .map((model, index) => ({
      ...model,
      maxContextTokens: details[index].maxContextTokens,
      loadedContextTokens: loaded.get(model.name) ?? null,
    }))
    .filter((_, index) => details[index].canChat)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, models };
}
