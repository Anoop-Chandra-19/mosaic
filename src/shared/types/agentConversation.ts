import type { ModelProviderError, ModelReplyPart, ModelUsage } from './modelReply';

/*
 * Conversation messages are stored in `seq` order. New messages are added; existing
 * message bodies are never edited. Bodies are stored as JSON and must stay readable.
 * Add optional fields or new message types for compatible changes. Other changes need
 * an upgrade step when reading older messages.
 */

/** A resume attachment with the label it had when the message was sent. */
export interface ResumeRef {
  sectionId: string;
  entryId?: string;
  bulletId?: string;
  label: string;
}

export interface UserMessageBody {
  type: 'user';
  text: string;
  resume: ResumeRef[];
  /** When true, suggestions may change only the attached parts of the resume. */
  isLimit: boolean;
}

/** A failed model request and the delay before retrying it. */
export interface StepRetry {
  error: ModelProviderError;
  waitMs: number;
}

export interface AssistantMessageBody {
  type: 'assistant';
  content: ModelReplyPart[];
  /** Omitted if the reply was stopped or failed before it finished. */
  finish?: 'complete' | 'outputLimit';
  /** Earlier failed requests that were retried. Omitted if there were none. */
  retries?: StepRetry[];
}

/**
 * Identifies the resume content a tool call targeted, using its names at the time of the call.
 * The UI builds labels from these fields; they do not contain display text and are not sent
 * to the model. Bullet and line numbers start at 1.
 */
export type ToolTarget =
  /** Headings of the sections that were read. */
  | { kind: 'resume'; sections: string[] }
  /** Version label shown in history, such as "v3.1". */
  | { kind: 'version'; version: string }
  | {
      kind: 'place';
      section: string;
      /** Organization name, or the entry title if there is no organization. */
      entry?: string;
      bullet?: number;
      /** Number of the other bullet in a merge. */
      lastBullet?: number;
      line?: number;
      /** Whether the call shows or hides the content on the resume. */
      show?: boolean;
    }
  /** The list being reordered: sections, entries, bullets, or lines. */
  | { kind: 'list'; of: 'section' | 'entry' | 'bullet' | 'line'; section?: string; entry?: string }
  /** `count` is the number of bullets and lines containing `find`. */
  | { kind: 'term'; find: string; replace: string; count: number };

export interface ToolResult {
  callId: string;
  content: string;
  isError?: boolean;
  /** Omitted in older messages or when the call's target could not be found. */
  target?: ToolTarget;
  /** The run ended before this call ran. Its error is not a failure of the tool itself. */
  notRun?: boolean;
  /** Why no tool result was received: `timeout`, `cancelled`, `stopped`, or `interrupted`. */
  checkName?: string;
  /** Call duration in milliseconds, including time the model spent writing its arguments. Omitted in older messages. */
  durationMs?: number;
  /** Call start time as a Unix timestamp in milliseconds. Omitted in older messages. */
  startedAt?: number;
}

export interface ToolResultsMessageBody {
  type: 'toolResults';
  results: ToolResult[];
}

/** Records a template change before the next run starts. */
export interface TemplateSwitchedMessageBody {
  type: 'templateSwitched';
  templateId: string;
  label: string;
  previousId?: string;
}

/**
 * Why a run stopped early: a safety limit, a provider error, an app error, or the user.
 * `connection` means retries ran out; `providerError` means retrying would not help.
 */
export type RunStopReason =
  | 'repeatedCall'
  | 'refusalsInARow'
  | 'stepLimit'
  | 'connection'
  | 'providerError'
  | 'appFault'
  | 'cancelled';

/**
 * Records why a run stopped. The UI uses these fields to explain the stop to the user.
 * This message is not sent to the model.
 */
export interface RunStoppedMessageBody {
  type: 'runStopped';
  reason: RunStopReason;
  /** Refusal reported by a safety check, or an error from Mosaic. */
  detail?: string;
  /** Original provider error for `connection` or `providerError` stops. */
  providerError?: ModelProviderError;
  /** Number of requests made for the failed step. */
  attempts?: number;
  /** Total time spent waiting between requests, in milliseconds. */
  waitedMs?: number;
  /** Failed requests that were retried before the step stopped without a reply. */
  retries?: StepRetry[];
}

export type MessageBody =
  | UserMessageBody
  | AssistantMessageBody
  | ToolResultsMessageBody
  | TemplateSwitchedMessageBody
  | RunStoppedMessageBody;

/** The transcript gets reasoning duration and length, not its text or provider state. Those stay in main. */
export type TranscriptReplyPart =
  | Exclude<ModelReplyPart, { type: 'reasoning' }>
  | { type: 'reasoning'; durationMs: number; textLength?: number };

/**
 * Message body sent to the transcript. Tool result content is omitted because it can be
 * large; the Trace view loads it when the user opens a result.
 */
export type TranscriptMessageBody =
  | Exclude<MessageBody, AssistantMessageBody | ToolResultsMessageBody>
  | (Omit<AssistantMessageBody, 'content'> & { content: TranscriptReplyPart[] })
  | { type: 'toolResults'; results: Omit<ToolResult, 'content'>[] };

/** Provider and model recorded when the run started. */
export interface RunModel {
  provider: string;
  model: string;
}

export interface TranscriptMessage {
  id: number;
  seq: number;
  /** Null if the message was written outside a run. */
  runId: number | null;
  /** Model used by the run, for display in stop notices. Null outside a run. */
  runModel: RunModel | null;
  /** Run number within the conversation, starting at 1. */
  runNumber?: number;
  body: TranscriptMessageBody;
  /** Token usage for an assistant message's request, if reported by the provider. */
  usage?: ModelUsage;
  createdAt: number;
}
