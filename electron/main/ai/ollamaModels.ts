import type { OllamaModel, OllamaModels } from '@/types/ai';

/** Where Ollama listens unless told otherwise. */
export const OLLAMA_URL = 'http://127.0.0.1:11434';

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
async function canChat(fetch: OllamaFetch, name: string): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/show`, {
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

/** The chat models pulled into the local Ollama, by name. Never throws. */
export async function listOllamaModels(fetch: OllamaFetch): Promise<OllamaModels> {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, reason: 'not-running' };
  }

  let pulled: OllamaModel[];
  try {
    if (!response.ok) throw new Error(`Ollama answered ${response.status}`);
    pulled = parseTags(await response.json());
  } catch {
    return { ok: false, reason: 'failed' };
  }

  const chat = await Promise.all(pulled.map((model) => canChat(fetch, model.name)));
  const models = pulled
    .filter((_, index) => chat[index])
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, models };
}
