import type { KeyedProvider, KeyTest } from '@shared/types/secrets';

/** `fetch`, narrowed to what a key test sends. Main passes Electron's `net.fetch`. */
export type KeyTestFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<Response>;

const TIMEOUT_MS = 10_000;

interface Probe {
  url: string;
  headers: Record<string, string>;
  /** The request looks the model up, so a 404 means the key works but can't reach it. */
  looksUpModel: boolean;
}

/**
 * One request that needs a valid key and costs no tokens. Where the provider can, it looks
 * up the model named in settings, so Test also says whether the key reaches it; OpenRouter's
 * model list is public, so there the request asks about the key itself. The key only ever
 * travels in a header — never in a URL, where it could end up in a log.
 */
function probeFor(provider: KeyedProvider, key: string, model: string): Probe {
  switch (provider) {
    case 'openai':
      return {
        url: `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
        headers: { Authorization: `Bearer ${key}` },
        looksUpModel: true,
      };
    case 'anthropic':
      return {
        url: `https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`,
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        looksUpModel: true,
      };
    case 'gemini':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ''))}`,
        headers: { 'x-goog-api-key': key },
        looksUpModel: true,
      };
    case 'openrouter':
      return {
        url: 'https://openrouter.ai/api/v1/key',
        headers: { Authorization: `Bearer ${key}` },
        looksUpModel: false,
      };
  }
}

/** Asks the provider whether `key` works. Every outcome is data; this never throws. */
export async function testApiKey(
  provider: KeyedProvider,
  key: string,
  model: string,
  fetch: KeyTestFetch
): Promise<KeyTest> {
  const { url, headers, looksUpModel } = probeFor(provider, key, model);
  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }

  const httpStatus = response.status;
  if (response.ok) return { ok: true, modelFound: looksUpModel ? true : null };
  if (httpStatus === 404 && looksUpModel) return { ok: true, modelFound: false };
  if (httpStatus === 401 || httpStatus === 403) return { ok: false, reason: 'refused', httpStatus };
  // Gemini turns down a bad key with a 400 rather than a 401.
  if (httpStatus === 400 && (await response.text().catch(() => '')).includes('API_KEY_INVALID')) {
    return { ok: false, reason: 'refused', httpStatus };
  }
  return { ok: false, reason: 'failed', httpStatus };
}
