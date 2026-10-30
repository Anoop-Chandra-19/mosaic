import { normalizeOpenAiCompatibleAddress } from '@shared/model-providers/serverAddress';
import type { OpenAiCompatibleModels } from '@shared/types/modelProviders';
import { SERVER_MODELS_TIMEOUT_MS } from '../providerEndpoints';

/** `fetch`, narrowed to what this call sends. Main passes Electron's `net.fetch`. */
export type OpenAiCompatibleModelsFetch = (
  url: string,
  init: { signal: AbortSignal }
) => Promise<Response>;

function parseModelIds(body: unknown): string[] {
  const listed = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(listed)) throw new Error('No model list in the answer');
  return listed.flatMap((entry: unknown) => {
    const id = (entry as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id !== '' ? [id] : [];
  });
}

/**
 * The models the server at `address` lists at `/v1/models`, by name. llama.cpp lists the one
 * it loaded. The address arrives from the renderer, so it is checked again here: only an
 * http(s) origin is ever fetched. Never throws.
 */
export async function listOpenAiCompatibleModels(
  fetch: OpenAiCompatibleModelsFetch,
  requestedAddress: unknown
): Promise<OpenAiCompatibleModels> {
  const address =
    typeof requestedAddress === 'string'
      ? normalizeOpenAiCompatibleAddress(requestedAddress)
      : null;
  if (address === null) return { ok: false, reason: 'invalid-address' };

  let response: Response;
  try {
    response = await fetch(`${address}/v1/models`, {
      signal: AbortSignal.timeout(SERVER_MODELS_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  try {
    if (!response.ok) throw new Error(`The server answered ${response.status}`);
    const models = parseModelIds(await response.json());
    return { ok: true, models: models.sort((a, b) => a.localeCompare(b)) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
