import type { APIError } from 'openai';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions';
import { isRecord } from '@shared/resume/validateResume';
import type { ModelProviderError } from '@shared/types/modelReply';
import type { ModelProvider, ModelRequest } from '../modelProvider';
import { noteArrivals } from '../noteArrivals';
import { readRateLimit } from '../readRateLimit';
import {
  buildChatCompletionsBody,
  describeChatCompletionsError,
  readChatCompletionsStream,
  type ChatDelta,
  type ChatStreamDialect,
} from './chatCompletionsStream';
import { createOpenAiClient, type OpenAiFetch } from './openAiClient';

/*
 * A server that speaks Chat Completions at `/v1`: LM Studio, llama.cpp's server, vLLM. No key
 * for now. Their reasoning is shown and never sent back. They share no error codes, so the
 * few problems the user can fix are told apart by what the server says, before the loop
 * decides whether to retry: llama.cpp answers a missing `--jinja` with a 500.
 */

export interface OpenAiCompatibleProviderOptions {
  /** Already checked with `normalizeOpenAiCompatibleAddress`. */
  address: string;
  /** Main passes Electron's `net.fetch`. */
  fetch: OpenAiFetch;
  now?: () => number;
}

/** The SDK needs a key to send; these servers ignore it. */
const NO_API_KEY = 'none';

type ReasoningDelta = ChatDelta & {
  reasoning_content?: string | null;
  reasoning?: string | null;
};

const SERVER_STREAM: ChatStreamDialect<never> = {
  serverName: 'The server',
  reasoning: {
    read(delta) {
      const { reasoning_content: content, reasoning } = delta as ReasoningDelta;
      const text = content || reasoning;
      return text ? { text, pieces: [] } : null;
    },
    addPiece: () => {},
    toProviderState: () => undefined,
  },
};

/** Problems named by the server's words, whatever status it gave them. */
const REASON_BY_WORDS: {
  words: RegExp;
  reason: 'toolsUnsupported' | 'context-too-long' | 'model-not-found';
}[] = [
  {
    words:
      /--jinja|--enable-auto-tool-choice|--tool-call-parser|does not support tools|tools? (is|are) not supported/i,
    reason: 'toolsUnsupported',
  },
  {
    words:
      /available context size|maximum context length|greater than the context length|context (length|window).*(exceed|overflow)/i,
    reason: 'context-too-long',
  },
  { words: /model.*(does not exist|not found)|no models? loaded/i, reason: 'model-not-found' },
];

export function createOpenAiCompatibleModelProvider({
  address,
  fetch,
  now = () => performance.now(),
}: OpenAiCompatibleProviderOptions): ModelProvider {
  const client = createOpenAiClient(NO_API_KEY, `${address}/v1`, fetch);
  return {
    async *streamReply(request) {
      try {
        const chunks = await client.chat.completions.create(buildRequestBody(request), {
          signal: request.signal,
        });
        yield* readChatCompletionsStream(noteArrivals(chunks, request), SERVER_STREAM, now);
      } catch (error) {
        if (request.signal.aborted) return;
        yield { type: 'error', error: describeChatCompletionsError(error, sortApiError) };
      }
    },
  };
}

function buildRequestBody(request: ModelRequest): ChatCompletionCreateParamsStreaming {
  return { ...buildChatCompletionsBody(request), stream_options: { include_usage: true } };
}

/** `{ error: { message } }`, or LM Studio's `{ error: "…" }`; else the SDK's, without its status. */
function readServerWords(error: APIError): string {
  const body: unknown = error.error;
  if (typeof body === 'string') return body;
  if (isRecord(body) && typeof body.message === 'string') return body.message;
  return error.message.replace(/^\d{3} /, '');
}

function sortApiError(error: APIError): ModelProviderError {
  const message = readServerWords(error);
  const httpStatus = error.status;
  const named = REASON_BY_WORDS.find(({ words }) => words.test(message));
  if (named) return { reason: named.reason, message, httpStatus };
  if (httpStatus === 401 || httpStatus === 403)
    return { reason: 'keyRefused', message, httpStatus };
  if (httpStatus === 429)
    return { ...readRateLimit(error.headers ?? new Headers()), message, httpStatus };
  return { reason: 'failed', message, httpStatus };
}
