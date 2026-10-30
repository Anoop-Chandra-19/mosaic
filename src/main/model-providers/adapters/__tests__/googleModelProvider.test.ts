import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import { createGoogleModelProvider, type GoogleFetch } from '../googleModelProvider';
import type { ModelRequest } from '../../modelProvider';

const API_KEY = 'AIza-test-0000';

const TOOL = {
  name: 'read_document',
  description: 'Read the open resume.',
  inputSchema: { type: 'object', properties: {} },
};

const USAGE_METADATA = {
  promptTokenCount: 2400,
  cachedContentTokenCount: 2048,
  candidatesTokenCount: 31,
  thoughtsTokenCount: 120,
};

/** What `USAGE_METADATA` adds up to: thinking counts as output. */
const USAGE = { inputTokens: 2400, outputTokens: 151, cachedInputTokens: 2048 };

/** A streamed chunk, as Google sends it: the reply's first candidate. */
type RecordedChunk = Record<string, unknown>;

function chunk(parts: RecordedChunk[], finishReason?: string): RecordedChunk {
  return {
    candidates: [{ content: { role: 'model', parts }, finishReason }],
    ...(finishReason ? { usageMetadata: USAGE_METADATA } : {}),
  };
}

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    model: 'gemini-3.8-flash',
    system: 'You help with resumes.',
    messages: [{ role: 'user', text: 'Tighten my summary.' }],
    tools: [TOOL],
    cacheKey: 'mosaic-conversation-1',
    signal: new AbortController().signal,
    ...overrides,
  };
}

/** Each piece is read as it came: Google sends an error midway as bare JSON. */
function streamed(...pieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

const sse = (...chunks: RecordedChunk[]) =>
  streamed(...chunks.map((sent) => `data: ${JSON.stringify(sent)}\r\n\r\n`));

function failedWith(status: number, error: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: { code: status, ...error } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface SentRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** A Google that answers with `reply`, remembering every request it was sent. */
function google(reply: (init?: RequestInit) => Response | Promise<Response>) {
  const sent: SentRequest[] = [];
  const fetch: GoogleFetch = async (url, init) => {
    sent.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return reply(init);
  };
  let time = 0;
  const provider = createGoogleModelProvider({
    apiKey: API_KEY,
    fetch,
    now: () => (time += 400),
  });
  return { provider, sent };
}

async function collect(events: AsyncIterable<ModelStreamEvent>): Promise<ModelStreamEvent[]> {
  const collected: ModelStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('createGoogleModelProvider', () => {
  it('streams text and finishes with its tokens, thinking counted as output', async () => {
    const { provider } = google(() =>
      sse(chunk([{ text: 'Led a team ' }]), chunk([{ text: 'of five.' }], 'STOP'))
    );
    expect(await collect(provider.streamReply(request()))).toEqual([
      { type: 'textDelta', text: 'Led a team ' },
      { type: 'textDelta', text: 'of five.' },
      { type: 'finish', reason: 'complete', usage: USAGE },
    ]);
  });

  it('passes on thoughts, and each signature just before the part it came on', async () => {
    const { provider } = google(() =>
      sse(
        chunk([{ text: 'Read the resume first.', thought: true }]),
        chunk([
          {
            functionCall: { name: 'read_document', args: { from: 'start' } },
            thoughtSignature: 'CiQBkB-call',
          },
          { functionCall: { id: 'call-2', name: 'read_document', args: {} } },
        ]),
        chunk([{ text: 'Done.' }]),
        chunk([{ text: '', thoughtSignature: 'CiQBkB-text' }], 'STOP')
      )
    );
    const events = await collect(provider.streamReply(request()));
    expect(events).toEqual([
      { type: 'reasoningStart' },
      {
        type: 'reasoningEnd',
        text: 'Read the resume first.',
        durationMs: 400,
        providerState: { type: 'googleThought', signature: 'CiQBkB-call' },
      },
      {
        type: 'toolCall',
        callId: expect.any(String),
        name: 'read_document',
        args: { from: 'start' },
      },
      { type: 'toolCall', callId: 'call-2', name: 'read_document', args: {} },
      { type: 'textDelta', text: 'Done.' },
      { type: 'reasoningStart' },
      {
        type: 'reasoningEnd',
        durationMs: 0,
        providerState: { type: 'googleThought', signature: 'CiQBkB-text' },
      },
      { type: 'finish', reason: 'complete', usage: USAGE },
    ]);
  });

  it('sends the conversation in alternating turns, signatures back on their parts, the key only in its header', async () => {
    const { provider, sent } = google(() => sse(chunk([{ text: 'Done.' }], 'STOP')));
    const thought = (signature: string) => ({
      type: 'reasoning' as const,
      text: 'Read first.',
      durationMs: 800,
      providerState: { type: 'googleThought', signature },
    });
    await collect(
      provider.streamReply(
        request({
          messages: [
            { role: 'user', text: 'Tighten my summary.' },
            {
              role: 'assistant',
              parts: [
                thought('CiQBkB-call'),
                { type: 'toolCall', callId: 'call-1', name: 'read_document', args: {} },
                { type: 'toolCall', callId: 'call-2', name: 'propose_rewrite', args: '{"to":' },
              ],
            },
            {
              role: 'toolResult',
              callId: 'call-1',
              toolName: 'read_document',
              content: 'Summary…',
            },
            {
              role: 'toolResult',
              callId: 'call-2',
              toolName: 'propose_rewrite',
              content: 'The arguments aren’t JSON.',
              isError: true,
            },
            {
              role: 'assistant',
              parts: [
                // Another provider's reasoning, after a switch, isn't sent.
                { type: 'reasoning', durationMs: 300, providerState: { type: 'thinking' } },
                { type: 'text', text: 'Rewrote it.' },
                thought('CiQBkB-text'),
              ],
            },
            { role: 'user', text: 'Shorter.' },
          ],
        })
      )
    );

    const [{ url, headers, body }] = sent;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse'
    );
    expect(headers.get('x-goog-api-key')).toBe(API_KEY);
    expect(url).not.toContain(API_KEY);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: 'You help with resumes.' }] },
      tools: [
        {
          functionDeclarations: [{ name: 'read_document', parametersJsonSchema: TOOL.inputSchema }],
        },
      ],
      generationConfig: { thinkingConfig: { includeThoughts: true } },
    });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'Tighten my summary.' }] },
      {
        role: 'model',
        parts: [
          {
            functionCall: { id: 'call-1', name: 'read_document', args: {} },
            thoughtSignature: 'CiQBkB-call',
          },
          { functionCall: { id: 'call-2', name: 'propose_rewrite', args: {} } },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call-1',
              name: 'read_document',
              response: { output: 'Summary…' },
            },
          },
          {
            functionResponse: {
              id: 'call-2',
              name: 'propose_rewrite',
              response: { error: 'The arguments aren’t JSON.' },
            },
          },
        ],
      },
      {
        role: 'model',
        parts: [{ text: 'Rewrote it.' }, { text: '', thoughtSignature: 'CiQBkB-text' }],
      },
      { role: 'user', parts: [{ text: 'Shorter.' }] },
    ]);
  });

  it.each([
    ['MAX_TOKENS', { type: 'finish', reason: 'outputLimit', usage: USAGE }],
    ['SAFETY', { type: 'error', error: { reason: 'contentBlocked' } }],
    [
      'MALFORMED_FUNCTION_CALL',
      {
        type: 'error',
        error: { reason: 'failed', message: 'The model wrote a tool call Google couldn’t read' },
      },
    ],
  ])('ends a reply finished by %s', async (finishReason, expected) => {
    const { provider } = google(() => sse(chunk([], finishReason)));
    expect((await collect(provider.streamReply(request()))).at(-1)).toEqual(expected);
  });

  it('refuses a blocked prompt', async () => {
    const { provider } = google(() =>
      sse({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } })
    );
    expect(await collect(provider.streamReply(request()))).toEqual([
      { type: 'error', error: { reason: 'contentBlocked' } },
    ]);
  });

  it.each([
    [
      'a refused key',
      failedWith(400, {
        status: 'INVALID_ARGUMENT',
        message: 'API key not valid. Please pass a valid API key.',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' },
        ],
      }),
      {
        reason: 'keyRefused',
        message: 'API key not valid. Please pass a valid API key.',
        httpStatus: 400,
      },
    ],
    [
      'a key without permission',
      failedWith(403, { status: 'PERMISSION_DENIED', message: 'Permission denied.' }),
      { reason: 'keyRefused', message: 'Permission denied.', httpStatus: 403 },
    ],
    [
      'a rate limit, with its wait',
      failedWith(429, {
        status: 'RESOURCE_EXHAUSTED',
        message: 'You exceeded your current quota.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }],
      }),
      {
        reason: 'rateLimited',
        retryAfterMs: 37_000,
        message: 'You exceeded your current quota.',
        httpStatus: 429,
      },
    ],
    [
      'a missing model',
      failedWith(404, { status: 'NOT_FOUND', message: 'models/gemini-9 is not found.' }),
      { reason: 'model-not-found', message: 'models/gemini-9 is not found.', httpStatus: 404 },
    ],
    [
      'a conversation too long',
      failedWith(400, {
        status: 'INVALID_ARGUMENT',
        message: 'The input token count (1200000) exceeds the maximum number of tokens allowed.',
      }),
      {
        reason: 'context-too-long',
        message: 'The input token count (1200000) exceeds the maximum number of tokens allowed.',
        httpStatus: 400,
      },
    ],
    [
      'any other refusal',
      failedWith(400, {
        status: 'FAILED_PRECONDITION',
        message: 'User location is not supported.',
      }),
      { reason: 'failed', message: 'User location is not supported.', httpStatus: 400 },
    ],
    [
      'an overloaded Google',
      failedWith(503, { status: 'UNAVAILABLE', message: 'The model is overloaded.' }),
      { reason: 'failed', message: 'The model is overloaded.', httpStatus: 503 },
    ],
    [
      'an error midway',
      streamed(
        `data: ${JSON.stringify(chunk([{ text: 'Led' }]))}\r\n\r\n`,
        JSON.stringify({ error: { code: 500, status: 'INTERNAL', message: 'Internal error.' } })
      ),
      { reason: 'failed', message: 'Internal error.', httpStatus: 500 },
    ],
    [
      'a reply cut short',
      sse(chunk([{ text: 'Led' }])),
      { reason: 'failed', message: 'Google stopped before the reply was finished' },
    ],
  ])('sorts %s, keeping Google’s words', async (_name, response, expected) => {
    const { provider } = google(() => response);
    const events = await collect(provider.streamReply(request()));
    expect(events.at(-1)).toEqual({ type: 'error', error: expected });
  });

  it('says what the network said when nothing answered', async () => {
    const refused = new TypeError('fetch failed', {
      cause: new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com'),
    });
    const { provider } = google(() => {
      throw refused;
    });
    expect(await collect(provider.streamReply(request()))).toEqual([
      {
        type: 'error',
        error: {
          reason: 'unreachable',
          message: 'getaddrinfo ENOTFOUND generativelanguage.googleapis.com',
        },
      },
    ]);
  });

  it('ends quietly when stopped', async () => {
    const stop = new AbortController();
    const { provider } = google(() => {
      stop.abort();
      throw new DOMException('This operation was aborted', 'AbortError');
    });
    expect(await collect(provider.streamReply(request({ signal: stop.signal })))).toEqual([]);
  });
});
