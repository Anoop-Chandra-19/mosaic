import type { APIError } from 'openai';
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions';
import { isRecord } from '@shared/resume/validateResume';
import type { ModelProviderError, ModelReplyPart } from '@shared/types/modelReply';
import {
  buildChatCompletionsBody,
  describeChatCompletionsError,
  readChatCompletionsStream,
  type ChatDelta,
  type ChatStreamDialect,
} from './chatCompletionsStream';
import type { ModelProvider, ModelRequest } from '../modelProvider';
import { createOpenAiClient, type OpenAiFetch } from './openAiClient';
import { PROVIDER_API_URL } from '../providerEndpoints';
import { readRateLimit } from '../readRateLimit';

/*
 * OpenRouter, through its OpenAI-compatible Chat Completions (`chatCompletionsStream.ts`).
 * It routes each request to a provider behind it. Reasoning arrives as `reasoning_details`
 * pieces, merged by index, stored as the reasoning part's `providerState` and sent back
 * unchanged, so the model keeps its reasoning across tool calls. OpenRouter's own fields
 * (reasoning details, caching, error metadata) are typed here, since the SDK doesn't know
 * them.
 */

export interface OpenRouterProviderOptions {
  apiKey: string;
  /** Main passes Electron's `net.fetch`. */
  fetch: OpenAiFetch;
  now?: () => number;
}

/**
 * One piece of reasoning, as the provider behind OpenRouter gave it: `reasoning.text`,
 * `reasoning.summary` or `reasoning.encrypted`. Kept whole, fields we don't read included,
 * since it goes back unchanged.
 */
type ReasoningDetail = { type: string; index?: number } & Record<string, unknown>;

/** What a stored reasoning part holds for OpenRouter. */
interface OpenRouterReasoning {
  type: 'openrouter';
  details: ReasoningDetail[];
}

type OpenRouterDelta = ChatDelta & {
  reasoning?: string | null;
  reasoning_details?: ReasoningDetail[];
};

type OpenRouterAssistantMessage = ChatCompletionAssistantMessageParam & {
  reasoning_details?: ReasoningDetail[];
};

type OpenRouterRequestBody = ChatCompletionCreateParamsStreaming & {
  /** Asks providers that cache only when asked (Anthropic's) to cache the conversation so far. */
  cache_control: { type: 'ephemeral' };
  /** Keeps a conversation on one provider endpoint, so its cache stays warm. */
  session_id: string;
};

/** Streamed pieces of these fields are joined; any other field takes its latest value. */
const JOINED_DETAIL_FIELDS = new Set(['text', 'summary', 'data']);

type NamedReason = Exclude<ModelProviderError['reason'], 'failed'>;

/** A request error's status is its code; one partway through has the code alone. */
const REASON_BY_CODE: Record<number, NamedReason | undefined> = {
  401: 'keyRefused',
  402: 'quotaExceeded',
  404: 'model-not-found',
  429: 'rateLimited',
};

const OPENROUTER_STREAM: ChatStreamDialect<ReasoningDetail> = {
  serverName: 'OpenRouter',
  reasoning: {
    read(delta) {
      const { reasoning, reasoning_details: details } = delta as OpenRouterDelta;
      if (!reasoning && !details?.length) return null;
      return { text: reasoning ?? '', pieces: details ?? [] };
    },
    addPiece: addReasoningDetail,
    toProviderState: (details): OpenRouterReasoning | undefined =>
      details.length > 0 ? { type: 'openrouter', details } : undefined,
  },
};

export function createOpenRouterModelProvider({
  apiKey,
  fetch,
  now = () => performance.now(),
}: OpenRouterProviderOptions): ModelProvider {
  const client = createOpenAiClient(apiKey, PROVIDER_API_URL.openrouter, fetch);
  return {
    async *streamReply(request) {
      try {
        const chunks = await client.chat.completions.create(buildRequestBody(request), {
          signal: request.signal,
        });
        yield* readChatCompletionsStream(chunks, OPENROUTER_STREAM, now);
      } catch (error) {
        if (request.signal.aborted) return;
        yield { type: 'error', error: describeChatCompletionsError(error, sortApiError) };
      }
    },
  };
}

function buildRequestBody(request: ModelRequest): OpenRouterRequestBody {
  return {
    ...buildChatCompletionsBody(request, addReasoningDetails),
    cache_control: { type: 'ephemeral' },
    session_id: request.cacheKey,
  };
}

/** OpenRouter's reasoning goes back on the reply it came with. */
function addReasoningDetails(
  message: ChatCompletionAssistantMessageParam,
  parts: ModelReplyPart[]
): OpenRouterAssistantMessage {
  const details = parts.flatMap((part) =>
    part.type === 'reasoning' && isOpenRouterReasoning(part.providerState)
      ? part.providerState.details
      : []
  );
  return details.length > 0 ? { ...message, reasoning_details: details } : message;
}

/** Reasoning OpenRouter sent; another provider's, in a conversation that switched, isn't sent. */
function isOpenRouterReasoning(state: unknown): state is OpenRouterReasoning {
  return isRecord(state) && state.type === 'openrouter' && Array.isArray(state.details);
}

/** A piece with an index already seen continues that detail; any other starts one. */
function addReasoningDetail(details: ReasoningDetail[], piece: ReasoningDetail): void {
  const continued = details.find(
    (detail) => piece.index !== undefined && detail.index === piece.index
  );
  if (!continued) {
    details.push({ ...piece });
    return;
  }
  for (const [field, value] of Object.entries(piece)) {
    if (value === null || value === undefined) continue;
    const before = continued[field];
    const isJoined =
      JOINED_DETAIL_FIELDS.has(field) && typeof before === 'string' && typeof value === 'string';
    continued[field] = isJoined ? before + value : value;
  }
}

/** An error status, or an error chunk partway through, which has the code alone. */
function sortApiError(error: APIError, body: Record<string, unknown>): ModelProviderError {
  return sortError({
    code: error.status ?? (typeof body.code === 'number' ? body.code : undefined),
    httpStatus: error.status,
    message: readErrorMessage(body) ?? error.message,
    metadata: isRecord(body.metadata) ? body.metadata : {},
    headers: error.headers,
  });
}

/**
 * OpenRouter's words, then, when it passes on the error of the provider behind it, that
 * provider's own, as it came.
 */
function readErrorMessage(body: Record<string, unknown>): string | undefined {
  if (typeof body.message !== 'string') return undefined;
  const raw = isRecord(body.metadata) ? body.metadata.raw : undefined;
  return typeof raw === 'string' && raw !== '' ? `${body.message}\n${raw}` : body.message;
}

interface OpenRouterErrorFacts {
  code?: number;
  httpStatus?: number;
  message: string;
  metadata: Record<string, unknown>;
  headers?: Headers;
}

function sortError({
  code,
  httpStatus,
  message,
  metadata,
  headers,
}: OpenRouterErrorFacts): ModelProviderError {
  // OpenRouter says "No endpoints found that support tool use" when no route takes tools.
  if (code === 404 && /tool use/i.test(message)) {
    return { reason: 'toolsUnsupported', message, httpStatus };
  }
  // A 403 is also a key's permissions or a guardrail; moderation is the one with reasons.
  if (code === 403 && metadata.reasons !== undefined) {
    return { reason: 'contentBlocked', message, httpStatus };
  }
  const reason = code === undefined ? undefined : REASON_BY_CODE[code];
  if (reason === 'rateLimited' && headers) {
    return { ...readRateLimit(headers), message, httpStatus };
  }
  if (reason) return { reason, message, httpStatus };
  return { reason: 'failed', message, httpStatus };
}
