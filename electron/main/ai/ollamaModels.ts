import { normalizeOllamaAddress } from '@/lib/ai/ollamaAddress';
import type { OllamaModel, OllamaModels } from '@/types/ai';

const TIMEOUT_MS = 3000;

/** `fetch`, narrowed to what these calls send. Main passes Electron's `net.fetch`. */
export type OllamaFetch = (
  url: string,
  init: { method?: 'POST'; body?: string; signal: AbortSignal }
) => Promise<Response>;

function parseTags(body: unknown): OllamaModel[] {
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

/**
 * Whether a model can chat. Ollama lists embedding models alongside chat ones, and only
 * `/api/show` says which is which. An older Ollama without capabilities, or a lookup that
 * fails, keeps the model — better offered than hidden.
 */
async function canChat(fetch: OllamaFetch, address: string, name: string): Promise<boolean> {
  try {
    const response = await fetch(`${address}/api/show`, {
      method: 'POST',
      body: JSON.stringify({ model: name }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const { capabilities } = (await response.json()) as { capabilities?: unknown };
    return !Array.isArray(capabilities) || capabilities.includes('completion');
  } catch {
    return true;
  }
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
    response = await fetch(`${address}/api/tags`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  let pulled: OllamaModel[];
  try {
    if (!response.ok) throw new Error(`Ollama answered ${response.status}`);
    pulled = parseTags(await response.json());
  } catch {
    return { ok: false, reason: 'failed' };
  }

  const chat = await Promise.all(pulled.map((model) => canChat(fetch, address, model.name)));
  const models = pulled
    .filter((_, index) => chat[index])
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, models };
}
