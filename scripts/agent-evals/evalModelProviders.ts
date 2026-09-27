/**
 * Provider-neutral chat for the agent evals, over plain `fetch`. Keys come from the
 * environment (`.env` beside these scripts). This is a measuring tool, not the app's provider
 * layer: it favours seeing each API's raw behaviour over retrying around it.
 */
import { setTimeout as sleep } from 'node:timers/promises';

export interface EvalTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export type EvalMessage =
  | { role: 'user'; text: string }
  /** `raw` is the provider's own assistant turn, replayed unchanged so reasoning survives. */
  | { role: 'assistant'; text: string; calls: ToolCall[]; raw?: unknown }
  | { role: 'tool'; callId: string; name: string; result: string };

export interface ModelReply {
  calls: ToolCall[];
  text: string;
  raw?: unknown;
  tokensIn?: number;
  tokensOut?: number;
}

export type ChatWithModel = (
  system: string,
  messages: EvalMessage[],
  tools: EvalTool[]
) => Promise<ModelReply>;

const CALL_TIMEOUT_MS = 120_000;
const RETRY_WAITS_MS = [2000, 5000, 15000, 30000];
const TRANSIENT_ERROR =
  /high demand|overloaded|rate limit|try again|unavailable|exceeded your current quota|timeout|429|503|529/i;

function describeApiError(error: unknown): string {
  if (typeof error === 'string') return error;
  const { code, message, metadata } = error as {
    code?: unknown;
    message?: string;
    metadata?: unknown;
  };
  return [code, message, metadata ? JSON.stringify(metadata) : ''].filter(Boolean).join(' ');
}

async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const json = (await response.json()) as T & { error?: unknown };
  if (json.error) throw new Error(describeApiError(json.error));
  return json;
}

function parseToolArguments(json: string | undefined): unknown {
  try {
    return JSON.parse(json || '{}');
  } catch {
    // Left as the raw string, so the checks refuse it the way the app would.
    return json;
  }
}

/** Anthropic and Gemini want every result for one assistant turn in a single user turn. */
function groupToolResults(messages: EvalMessage[]) {
  const grouped: (EvalMessage | Extract<EvalMessage, { role: 'tool' }>[])[] = [];
  for (const message of messages) {
    const last = grouped[grouped.length - 1];
    if (message.role === 'tool' && Array.isArray(last)) last.push(message);
    else grouped.push(message.role === 'tool' ? [message] : message);
  }
  return grouped;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
    tool_calls?: { function: { name: string; arguments: unknown } }[];
  };
  prompt_eval_count?: number;
  eval_count?: number;
}

function chatWithOllama(model: string, think: boolean): ChatWithModel {
  const baseUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  return async (system, messages, tools) => {
    const json = await postJson<OllamaChatResponse>(
      `${baseUrl}/api/chat`,
      {},
      {
        model,
        stream: false,
        think,
        options: { temperature: 0.3 },
        tools: tools.map((tool) => ({ type: 'function', function: tool })),
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) =>
            m.role === 'user'
              ? { role: 'user', content: m.text }
              : m.role === 'assistant'
                ? {
                    role: 'assistant',
                    content: m.text,
                    tool_calls: m.calls.map((c) => ({
                      function: { name: c.name, arguments: c.args },
                    })),
                  }
                : { role: 'tool', tool_name: m.name, content: m.result }
          ),
        ],
      }
    );
    const calls = (json.message?.tool_calls ?? []).map((c, i) => ({
      id: `ollama-${i}`,
      name: c.function.name,
      args: c.function.arguments,
    }));
    return {
      calls,
      text: json.message?.content ?? '',
      tokensIn: json.prompt_eval_count,
      tokensOut: json.eval_count,
    };
  };
}

interface OpenAiOutputItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string }[];
}

interface OpenAiResponse {
  output?: OpenAiOutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * The Responses API: OpenAI's current models refuse function tools with reasoning on Chat
 * Completions. Nothing is stored server-side, so reasoning comes back encrypted and is
 * replayed as it came.
 */
function chatWithOpenAi(model: string, effort: string): ChatWithModel {
  return async (system, messages, tools) => {
    const json = await postJson<OpenAiResponse>(
      'https://api.openai.com/v1/responses',
      { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      {
        model,
        instructions: system,
        store: false,
        include: ['reasoning.encrypted_content'],
        reasoning: { effort },
        tools: tools.map((tool) => ({ type: 'function', ...tool })),
        input: messages.flatMap((m): unknown[] =>
          m.role === 'user'
            ? [{ role: 'user', content: m.text }]
            : m.role === 'assistant'
              ? ((m.raw as OpenAiOutputItem[] | undefined) ??
                m.calls.map((c) => ({
                  type: 'function_call',
                  call_id: c.id,
                  name: c.name,
                  arguments: JSON.stringify(c.args),
                })))
              : [{ type: 'function_call_output', call_id: m.callId, output: m.result }]
        ),
      }
    );
    const output = json.output ?? [];
    return {
      calls: output
        .filter((item) => item.type === 'function_call')
        .map((item) => ({
          id: item.call_id ?? '',
          name: item.name ?? '',
          args: parseToolArguments(item.arguments),
        })),
      text: output
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === 'output_text')
        .map((part) => part.text ?? '')
        .join(''),
      raw: output,
      tokensIn: json.usage?.input_tokens,
      tokensOut: json.usage?.output_tokens,
    };
  };
}

interface AnthropicBlock {
  type: string;
  id?: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** `effort` null turns thinking off; current models only take adaptive thinking. */
function chatWithAnthropic(model: string, effort: string | null): ChatWithModel {
  return async (system, messages, tools) => {
    const json = await postJson<AnthropicResponse>(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
      {
        model,
        max_tokens: effort ? 8192 : 2048,
        ...(effort ? { thinking: { type: 'adaptive' }, output_config: { effort } } : {}),
        system,
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
        messages: groupToolResults(messages).map((m) =>
          Array.isArray(m)
            ? {
                role: 'user',
                content: m.map((r) => ({
                  type: 'tool_result',
                  tool_use_id: r.callId,
                  content: r.result,
                })),
              }
            : m.role === 'user'
              ? { role: 'user', content: m.text }
              : {
                  role: 'assistant',
                  // Thinking blocks must go back unchanged.
                  content:
                    m.role === 'assistant' && m.raw
                      ? m.raw
                      : m.role === 'assistant'
                        ? m.calls.map((c) => ({
                            type: 'tool_use',
                            id: c.id,
                            name: c.name,
                            input: c.args,
                          }))
                        : [],
                }
        ),
      }
    );
    return {
      calls: json.content
        .filter((block) => block.type === 'tool_use')
        .map((block) => ({ id: block.id ?? '', name: block.name ?? '', args: block.input })),
      text: json.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join(''),
      raw: json.content,
      tokensIn: json.usage?.input_tokens,
      tokensOut: json.usage?.output_tokens,
    };
  };
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args: unknown };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

function chatWithGemini(model: string, thinkingBudget: number): ChatWithModel {
  return async (system, messages, tools) => {
    const json = await postJson<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { 'x-goog-api-key': process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '' },
      {
        systemInstruction: { parts: [{ text: system }] },
        tools: [{ functionDeclarations: tools }],
        generationConfig: { thinkingConfig: { thinkingBudget } },
        contents: groupToolResults(messages).map((m) =>
          Array.isArray(m)
            ? {
                role: 'user',
                parts: m.map((r) => ({
                  functionResponse: { name: r.name, response: { result: r.result } },
                })),
              }
            : m.role === 'user'
              ? { role: 'user', parts: [{ text: m.text }] }
              : {
                  role: 'model',
                  // Thought signatures ride on the parts, so the parts go back unchanged.
                  parts:
                    m.role === 'assistant' && m.raw
                      ? m.raw
                      : m.role === 'assistant'
                        ? m.calls.map((c) => ({ functionCall: { name: c.name, args: c.args } }))
                        : [],
                }
        ),
      }
    );
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const usage = json.usageMetadata;
    return {
      calls: parts
        .filter((part) => part.functionCall)
        .map((part, i) => ({
          id: `gemini-${i}`,
          name: part.functionCall?.name ?? '',
          args: part.functionCall?.args,
        })),
      text: parts
        .filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join(''),
      raw: parts,
      tokensIn: usage?.promptTokenCount,
      tokensOut: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    };
  };
}

interface ChatCompletionsMessage {
  content?: string | null;
  tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
  reasoning_details?: unknown;
}

interface ChatCompletionsResponse {
  choices?: { message?: ChatCompletionsMessage }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * OpenRouter and OpenAI-compatible servers. Reasoning comes back in whichever field the
 * server uses; `reasoning_details` must go back unchanged in a tool loop.
 */
function chatWithChatCompletions(
  baseUrl: string,
  key: string | undefined,
  model: string,
  reasoning: Record<string, unknown> | null
): ChatWithModel {
  return async (system, messages, tools) => {
    const json = await postJson<ChatCompletionsResponse>(
      `${baseUrl}/chat/completions`,
      key ? { authorization: `Bearer ${key}` } : {},
      {
        model,
        ...(reasoning ? { reasoning } : {}),
        tools: tools.map((tool) => ({ type: 'function', function: tool })),
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => {
            if (m.role === 'user') return { role: 'user', content: m.text };
            if (m.role === 'tool')
              return { role: 'tool', tool_call_id: m.callId, content: m.result };
            const details = (m.raw as ChatCompletionsMessage | undefined)?.reasoning_details;
            return {
              role: 'assistant',
              content: m.text || null,
              tool_calls: m.calls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.args) },
              })),
              ...(details ? { reasoning_details: details } : {}),
            };
          }),
        ],
      }
    );
    const message = json.choices?.[0]?.message ?? {};
    return {
      calls: (message.tool_calls ?? []).map((c, i) => ({
        id: c.id ?? `call-${i}`,
        name: c.function?.name ?? '',
        args: parseToolArguments(c.function?.arguments),
      })),
      text: String(message.content ?? '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim(),
      raw: message,
      tokensIn: json.usage?.prompt_tokens,
      tokensOut: json.usage?.completion_tokens,
    };
  };
}

function withRetries(chat: ChatWithModel): ChatWithModel {
  return async (...args) => {
    for (const waitMs of RETRY_WAITS_MS) {
      try {
        return await chat(...args);
      } catch (error) {
        if (!TRANSIENT_ERROR.test(String(error))) throw error;
        const hinted = String(error).match(/retry in ([\d.]+)s/i);
        await sleep(hinted ? Math.ceil(Number(hinted[1]) * 1000) + 500 : waitMs);
      }
    }
    return chat(...args);
  };
}

const DEFAULT_MODELS: Record<string, string> = {
  ollama: 'qwen3.5:9b',
  openai: 'gpt-6-luna',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-3.8-flash',
};

/**
 * `provider[:model]`, e.g. `anthropic`, `openai:gpt-5.6-terra`,
 * `openrouter:qwen/qwen3.8-27b`, or `compatible:<model>` for a server at `COMPATIBLE_URL`.
 */
export function pickEvalModel(
  spec: string,
  think: boolean
): { chat: ChatWithModel; label: string } {
  const [provider, custom] = spec.split(/:(.+)/);
  const model = custom ?? DEFAULT_MODELS[provider];
  if (!model) throw new Error(`${spec}: name a model, e.g. ${provider}:<model>`);
  const chat =
    provider === 'ollama'
      ? chatWithOllama(model, think)
      : provider === 'openai'
        ? chatWithOpenAi(model, think ? 'medium' : 'none')
        : provider === 'anthropic'
          ? chatWithAnthropic(model, think ? 'medium' : null)
          : provider === 'gemini'
            ? chatWithGemini(model, think ? 4000 : 0)
            : provider === 'openrouter'
              ? chatWithChatCompletions(
                  'https://openrouter.ai/api/v1',
                  process.env.OPENROUTER_API_KEY,
                  model,
                  think ? { effort: 'medium' } : { enabled: false }
                )
              : provider === 'compatible'
                ? chatWithChatCompletions(
                    process.env.COMPATIBLE_URL ?? 'http://127.0.0.1:1234/v1',
                    process.env.COMPATIBLE_KEY,
                    model,
                    null
                  )
                : null;
  if (!chat) throw new Error(`Unknown provider "${provider}"`);
  const label = `${provider}-${model}${think ? '-think' : ''}`.replace(/[^\w.-]/g, '_');
  return { chat: withRetries(chat), label };
}
