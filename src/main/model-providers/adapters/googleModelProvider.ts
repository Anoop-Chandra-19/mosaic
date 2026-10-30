import { randomUUID } from 'node:crypto';
import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  type Content,
  type Fetch,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type GenerateContentResponseUsageMetadata,
  type Part,
} from '@google/genai';
import { isRecord } from '@shared/resume/validateResume';
import type {
  ModelProviderError,
  ModelReplyPart,
  ModelStreamEvent,
  ModelUsage,
} from '@shared/types/modelReply';
import type { ModelTool } from '@shared/types/modelTool';
import { describeNetworkError } from '../describeNetworkError';
import type { ModelMessage, ModelProvider, ModelRequest } from '../modelProvider';
import { PROVIDER_API_URL } from '../providerEndpoints';

/*
 * Google, through the Gemini API's native `streamGenerateContent` (its OpenAI-compatible
 * endpoint drops thought signatures). Each request sends the whole conversation; Google
 * caches repeated prefixes on its own. Thinking comes back as thought summaries and an
 * opaque signature on the part it belongs to. The signature is stored as a reasoning
 * part's `providerState`, just before that part, and goes back on it, as Google requires
 * for function calls.
 */

/** Electron's `net.fetch` takes no `URL` objects; the SDK only ever passes a string. */
export type GoogleFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface GoogleProviderOptions {
  apiKey: string;
  /** Main passes Electron's `net.fetch`. */
  fetch: GoogleFetch;
  now?: () => number;
}

type NamedReason = Exclude<ModelProviderError['reason'], 'failed'>;

/** The `status` in Google's error body; server errors stay `failed`, and are retried. */
const REASON_BY_STATUS: Record<string, NamedReason | undefined> = {
  UNAUTHENTICATED: 'keyRefused',
  PERMISSION_DENIED: 'keyRefused',
  NOT_FOUND: 'model-not-found',
  RESOURCE_EXHAUSTED: 'rateLimited',
};

/** Refusals Google sends as a plain `INVALID_ARGUMENT`, told apart by their reason or words. */
const REASON_BY_INVALID_ARGUMENT: [(error: GoogleErrorBody) => boolean, NamedReason][] = [
  [(error) => error.reasons.includes('API_KEY_INVALID'), 'keyRefused'],
  [(error) => /input token count.*exceeds/i.test(error.message), 'context-too-long'],
];

const BLOCKED_FINISH_REASONS: ReadonlySet<FinishReason> = new Set([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

/** Finishes that leave nothing to use; the loop asks again. */
const UNUSABLE_FINISH_WORDS: Partial<Record<FinishReason, string>> = {
  [FinishReason.MALFORMED_FUNCTION_CALL]: 'The model wrote a tool call Google couldn’t read',
  [FinishReason.UNEXPECTED_TOOL_CALL]: 'The model called a tool it wasn’t offered',
};

/** A thought signature, as stored in a reasoning part. */
interface GoogleThought {
  type: 'googleThought';
  signature: string;
}

/** The fetch failed before Google answered, in the network's words: kept apart from the SDK's errors. */
class NoAnswerError extends Error {}

export function createGoogleModelProvider({
  apiKey,
  fetch,
  now = () => performance.now(),
}: GoogleProviderOptions): ModelProvider {
  const client = createGoogleClient(apiKey, fetch);
  return {
    async *streamReply(request) {
      try {
        const chunks = await client.models.generateContentStream(buildContentRequest(request));
        yield* readReplyChunks(chunks, now);
      } catch (error) {
        if (request.signal.aborted) return;
        yield { type: 'error', error: describeGoogleError(error) };
      }
    },
  };
}

/**
 * Every setting the SDK would otherwise take from the environment (a key, Vertex AI, a
 * project, a base URL) is given, so only Settings decides where requests go and with which
 * key. No `retryOptions`, so the SDK doesn't retry.
 */
function createGoogleClient(apiKey: string, fetch: GoogleFetch): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    vertexai: false,
    apiVersion: 'v1beta',
    httpOptions: { baseUrl: PROVIDER_API_URL.google, fetch: markNoAnswer(fetch) },
  });
}

/** A fetch that failed, as an error `describeGoogleError` can tell from the SDK's. */
function markNoAnswer(fetch: GoogleFetch): Fetch {
  return async (url, init) => {
    try {
      return await fetch(String(url), init);
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      throw new NoAnswerError(describeNetworkError(error));
    }
  };
}

function buildContentRequest(request: ModelRequest): GenerateContentParameters {
  return {
    model: request.model,
    contents: toGoogleContents(request.messages),
    config: {
      systemInstruction: request.system,
      tools: [{ functionDeclarations: request.tools.map(toFunctionDeclaration) }],
      thinkingConfig: { includeThoughts: true },
      abortSignal: request.signal,
      // One request per step: the loop runs the tools, and asks again itself.
      automaticFunctionCalling: { disable: true },
      automaticContinuation: false,
    },
  };
}

function toFunctionDeclaration(tool: ModelTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema,
  };
}

/**
 * Google takes turns that alternate, so a step's tool results, and a message after them,
 * are one user turn: a step's calls are answered together.
 */
function toGoogleContents(messages: ModelMessage[]): Content[] {
  const turns: { role: 'user' | 'model'; parts: Part[] }[] = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts = toParts(message);
    if (parts.length === 0) continue;
    const last = turns.at(-1);
    if (last?.role === role) last.parts.push(...parts);
    else turns.push({ role, parts });
  }
  return turns;
}

function toParts(message: ModelMessage): Part[] {
  switch (message.role) {
    case 'user':
      return [{ text: message.text }];
    case 'assistant':
      return toModelParts(message.parts);
    case 'toolResult': {
      const key = message.isError ? 'error' : 'output';
      return [
        {
          functionResponse: {
            id: message.callId,
            name: message.toolName,
            response: { [key]: message.content },
          },
        },
      ];
    }
  }
}

/**
 * The reply's parts, each signature back on the part after it. One with nothing after it
 * came on an empty last part, and goes back on one.
 */
function toModelParts(replyParts: ModelReplyPart[]): Part[] {
  const parts: Part[] = [];
  let signature: string | undefined;
  for (const part of replyParts) {
    if (part.type === 'reasoning') {
      // Another provider's reasoning, in a conversation that switched, isn't sent.
      if (isGoogleThought(part.providerState)) signature = part.providerState.signature;
      continue;
    }
    parts.push({ ...toModelPart(part), thoughtSignature: signature });
    signature = undefined;
  }
  if (signature) parts.push({ text: '', thoughtSignature: signature });
  return parts.filter((part) => part.text !== '' || part.thoughtSignature);
}

function toModelPart(part: Exclude<ModelReplyPart, { type: 'reasoning' }>): Part {
  switch (part.type) {
    case 'text':
      return { text: part.text };
    case 'toolCall':
      return {
        functionCall: {
          id: part.callId,
          name: part.name,
          // Arguments that didn't parse can't go back as written: Google takes an object.
          // The tool's result already told the model what was wrong with them.
          args: isRecord(part.args) ? part.args : {},
        },
      };
  }
}

function isGoogleThought(state: unknown): state is GoogleThought {
  return isRecord(state) && state.type === 'googleThought' && typeof state.signature === 'string';
}

/** Thought summaries under way, until the first part of the answer. */
interface ThinkingUnderWay {
  startedAt: number;
  text: string;
  signature?: string;
}

/**
 * The chunks as our events. Text goes on as it arrives; a call goes on whole, as Google
 * sends it. Each chunk's usage is the total so far, and the last chunk has the finish.
 */
async function* readReplyChunks(
  chunks: AsyncIterable<GenerateContentResponse>,
  now: () => number
): AsyncGenerator<ModelStreamEvent> {
  let thinking: ThinkingUnderWay | null = null;
  let usage: GenerateContentResponseUsageMetadata | undefined;
  let finishReason: FinishReason | undefined;
  for await (const chunk of chunks) {
    if (chunk.promptFeedback?.blockReason) {
      yield { type: 'error', error: { reason: 'contentBlocked' } };
      return;
    }
    usage = chunk.usageMetadata ?? usage;
    const candidate = chunk.candidates?.[0];
    finishReason = candidate?.finishReason ?? finishReason;
    for (const part of candidate?.content?.parts ?? []) {
      if (part.thought) {
        if (!thinking) {
          thinking = { startedAt: now(), text: '' };
          yield { type: 'reasoningStart' };
        }
        thinking.text += part.text ?? '';
        thinking.signature = part.thoughtSignature ?? thinking.signature;
        continue;
      }
      if (thinking || part.thoughtSignature) {
        if (!thinking) yield { type: 'reasoningStart' };
        yield endThinking(thinking, part.thoughtSignature, now);
        thinking = null;
      }
      yield* readAnswerPart(part);
    }
  }
  if (thinking) yield endThinking(thinking, undefined, now);
  if (!finishReason) throw new Error('Google stopped before the reply was finished');
  yield finishEvent(finishReason, usage);
}

/** A signature Google sent with no thoughts shown took no time we saw. */
function endThinking(
  thinking: ThinkingUnderWay | null,
  partSignature: string | undefined,
  now: () => number
): ModelStreamEvent {
  const signature = partSignature ?? thinking?.signature;
  const providerState: GoogleThought | undefined = signature
    ? { type: 'googleThought', signature }
    : undefined;
  return {
    type: 'reasoningEnd',
    text: thinking?.text || undefined,
    durationMs: thinking ? now() - thinking.startedAt : 0,
    providerState,
  };
}

/** Parts other than text and calls (code, files, images), which Mosaic doesn't ask for, are passed over. */
function* readAnswerPart(part: Part): Generator<ModelStreamEvent> {
  if (part.text) yield { type: 'textDelta', text: part.text };
  if (part.functionCall?.name) {
    yield {
      type: 'toolCall',
      // Google leaves the id off unless it has one of its own.
      callId: part.functionCall.id ?? randomUUID(),
      name: part.functionCall.name,
      args: part.functionCall.args ?? {},
    };
  }
}

function finishEvent(
  finishReason: FinishReason,
  usage: GenerateContentResponseUsageMetadata | undefined
): ModelStreamEvent {
  if (BLOCKED_FINISH_REASONS.has(finishReason)) {
    return { type: 'error', error: { reason: 'contentBlocked' } };
  }
  const unusable = UNUSABLE_FINISH_WORDS[finishReason];
  if (unusable) return { type: 'error', error: { reason: 'failed', message: unusable } };
  const reason = finishReason === FinishReason.MAX_TOKENS ? 'outputLimit' : 'complete';
  return { type: 'finish', reason, usage: readUsage(usage) };
}

/** Google counts thinking apart from the answer; ours counts all output together. */
function readUsage(usage: GenerateContentResponseUsageMetadata | undefined): ModelUsage | null {
  if (usage?.promptTokenCount === undefined) return null;
  return {
    inputTokens: usage.promptTokenCount + (usage.toolUsePromptTokenCount ?? 0),
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    cachedInputTokens: usage.cachedContentTokenCount ?? 0,
  };
}

/** Google's error body, `{ error: { code, message, status, details } }`, as far as it was read. */
interface GoogleErrorBody {
  message: string;
  status?: string;
  reasons: string[];
  retryDelay?: string;
}

/** The SDK's errors: no answer, an error status, or an error midway through the stream. */
function describeGoogleError(error: unknown): ModelProviderError {
  if (error instanceof NoAnswerError) return { reason: 'unreachable', message: error.message };
  if (error instanceof ApiError) return sortError(readErrorBody(error.message), error.status);
  const message = error instanceof Error ? error.message : String(error);
  return { reason: 'failed', message };
}

/** The SDK puts Google's body in the message as JSON, after a prefix midway through a stream. */
function readErrorBody(sdkMessage: string): GoogleErrorBody {
  let inner: unknown;
  try {
    const body: unknown = JSON.parse(sdkMessage.slice(sdkMessage.indexOf('{')));
    inner = isRecord(body) ? body.error : undefined;
  } catch {
    return { message: sdkMessage, reasons: [] };
  }
  if (!isRecord(inner)) return { message: sdkMessage, reasons: [] };
  const details = Array.isArray(inner.details) ? inner.details.filter(isRecord) : [];
  return {
    message: typeof inner.message === 'string' ? inner.message : sdkMessage,
    status: typeof inner.status === 'string' ? inner.status : undefined,
    reasons: details.flatMap((detail) =>
      typeof detail.reason === 'string' ? [detail.reason] : []
    ),
    retryDelay: details
      .map((detail) => detail.retryDelay)
      .find((delay) => typeof delay === 'string'),
  };
}

function sortError(error: GoogleErrorBody, httpStatus: number): ModelProviderError {
  const { message } = error;
  const reason =
    error.status === 'INVALID_ARGUMENT'
      ? REASON_BY_INVALID_ARGUMENT.find(([matches]) => matches(error))?.[1]
      : error.status && REASON_BY_STATUS[error.status];
  if (reason === 'rateLimited') {
    const retryAfterMs = readRetryDelayMs(error.retryDelay);
    return retryAfterMs === undefined
      ? { reason, message, httpStatus }
      : { reason, retryAfterMs, message, httpStatus };
  }
  if (reason) return { reason, message, httpStatus };
  return { reason: 'failed', message, httpStatus };
}

/** Google says how long to wait in its `RetryInfo`, as seconds: "37s", "1.5s". */
function readRetryDelayMs(retryDelay: string | undefined): number | undefined {
  const seconds = Number(retryDelay?.match(/^(\d+(?:\.\d+)?)s$/)?.[1] ?? Number.NaN);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}
