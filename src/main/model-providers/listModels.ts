import type { KeyedProvider } from '@shared/types/secrets';

/** `fetch`, narrowed to what a key check or a model list sends. Main passes Electron's `net.fetch`. */
export type ModelListFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<Response>;

/** The chat models a key can use, newest first, and how many others were left out. */
export interface ProviderModels {
  models: string[];
  hiddenCount: number;
}

export type ModelListAnswer =
  | ({ ok: true } & ProviderModels)
  | { ok: false; reason: 'refused' | 'unreachable' | 'failed'; httpStatus?: number };

type Failure = Extract<ModelListAnswer, { ok: false }>;

const TIMEOUT_MS = 10_000;
/** Far beyond any provider's list; this only stops a list that never ends. */
const MAX_PAGES = 20;

/** A listed model, before the chat ones are picked out. */
interface ListedModel {
  id: string;
  /** Seconds or milliseconds since the epoch, when the provider says; only used to sort. */
  created: number;
  isChat: boolean;
}

interface ListPage {
  models: ListedModel[];
  /** The next page's URL, if there is one. */
  next: string | null;
}

interface ModelListSource {
  firstUrl: string;
  headers(key: string): Record<string, string>;
  readPage(body: unknown, url: string): ListPage;
}

type Entry = Record<string, unknown>;

function readEntries(list: unknown): Entry[] {
  if (!Array.isArray(list)) throw new Error('No model list in the answer');
  return list.filter(
    (entry: unknown): entry is Entry => typeof entry === 'object' && entry !== null
  );
}

const readText = (value: unknown) => (typeof value === 'string' ? value : '');
const readNumber = (value: unknown) => (typeof value === 'number' ? value : 0);
const readDate = (value: unknown) => (typeof value === 'string' ? Date.parse(value) || 0 : 0);

/** OpenAI lists every model the key can use, chat or not, and says nothing of which is which. */
const NOT_CHAT_OPENAI =
  /embedding|whisper|tts|dall-e|image|moderation|davinci|babbage|realtime|audio|transcribe|sora/;

/** Gemini's image, speech and embedding models also answer `generateContent`. */
const NOT_CHAT_GEMINI = /embedding|image|tts|aqa/;

function withQuery(url: string, name: string, value: string): string {
  const next = new URL(url);
  next.searchParams.set(name, value);
  return next.toString();
}

const SOURCES: Record<KeyedProvider, ModelListSource> = {
  openai: {
    firstUrl: 'https://api.openai.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    readPage: (body) => ({
      models: readEntries((body as Entry).data).map((entry) => ({
        id: readText(entry.id),
        created: readNumber(entry.created),
        isChat: !NOT_CHAT_OPENAI.test(readText(entry.id)),
      })),
      next: null,
    }),
  },
  anthropic: {
    firstUrl: 'https://api.anthropic.com/v1/models?limit=1000',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    readPage: (body, url) => {
      const page = body as Entry;
      return {
        models: readEntries(page.data).map((entry) => ({
          id: readText(entry.id),
          created: readDate(entry.created_at),
          isChat: true,
        })),
        next:
          page.has_more === true && typeof page.last_id === 'string'
            ? withQuery(url, 'after_id', page.last_id)
            : null,
      };
    },
  },
  gemini: {
    firstUrl: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
    headers: (key) => ({ 'x-goog-api-key': key }),
    readPage: (body, url) => {
      const page = body as Entry;
      return {
        models: readEntries(page.models).map((entry) => {
          const id = readText(entry.name).replace(/^models\//, '');
          const methods = Array.isArray(entry.supportedGenerationMethods)
            ? entry.supportedGenerationMethods
            : [];
          return {
            id,
            created: 0,
            isChat: methods.includes('generateContent') && !NOT_CHAT_GEMINI.test(id),
          };
        }),
        next:
          typeof page.nextPageToken === 'string' && page.nextPageToken !== ''
            ? withQuery(url, 'pageToken', page.nextPageToken)
            : null,
      };
    },
  },
  // The assistant works through tools, so a model that can't call them isn't offered.
  openrouter: {
    firstUrl: 'https://openrouter.ai/api/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    readPage: (body) => ({
      models: readEntries((body as Entry).data).map((entry) => ({
        id: readText(entry.id),
        created: readNumber(entry.created),
        isChat:
          Array.isArray(entry.supported_parameters) && entry.supported_parameters.includes('tools'),
      })),
      next: null,
    }),
  },
};

/** Sorts a provider's error answer, or returns null for a success. */
export async function readFailure(response: Response): Promise<Failure | null> {
  const httpStatus = response.status;
  if (response.ok) return null;
  if (httpStatus === 401 || httpStatus === 403) return { ok: false, reason: 'refused', httpStatus };
  // Gemini turns down a bad key with a 400 rather than a 401.
  if (httpStatus === 400 && (await response.text().catch(() => '')).includes('API_KEY_INVALID')) {
    return { ok: false, reason: 'refused', httpStatus };
  }
  return { ok: false, reason: 'failed', httpStatus };
}

/** Fetches one page; a failure is an answer, never a throw. */
export async function requestWithKey(
  url: string,
  headers: Record<string, string>,
  fetch: ModelListFetch
): Promise<Response | Failure> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

/**
 * The chat models `key` can use with `provider`, every page of them. Requests cost no tokens,
 * and the key only ever travels in a header — never in a URL, where it could end up in a log.
 * Every outcome is data; this never throws.
 */
export async function listModels(
  provider: KeyedProvider,
  key: string,
  fetch: ModelListFetch
): Promise<ModelListAnswer> {
  const source = SOURCES[provider];
  const headers = source.headers(key);
  const listed: ListedModel[] = [];
  let url: string | null = source.firstUrl;
  for (let page = 0; url !== null && page < MAX_PAGES; page++) {
    const response = await requestWithKey(url, headers, fetch);
    if (!(response instanceof Response)) return response;
    const failure = await readFailure(response);
    if (failure) return failure;
    try {
      const read = source.readPage(await response.json(), url);
      listed.push(...read.models);
      url = read.next;
    } catch {
      return { ok: false, reason: 'failed', httpStatus: response.status };
    }
  }
  const chat = listed.filter((model) => model.isChat && model.id !== '');
  // Newest first; a provider that gives no dates keeps its own order.
  chat.sort((a, b) => b.created - a.created);
  return {
    ok: true,
    models: [...new Set(chat.map((model) => model.id))],
    hiddenCount: listed.length - chat.length,
  };
}
