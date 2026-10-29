import type { ModelProviderError, ModelReplyPart } from './modelReply';

/*
 * A conversation is an append-only log of messages, read in `seq` order. Each message's
 * body is stored as JSON and never changed, so a body written once must stay readable:
 * changes are additive (new optional fields, new types), and anything else needs an
 * upgrade step on read.
 */

/** A part of the resume attached to a message, labelled as it was when sent. */
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
  /** The attached parts are the only ones a suggestion may change. */
  isLimit: boolean;
}

export interface AssistantMessageBody {
  type: 'assistant';
  content: ModelReplyPart[];
  /** Absent when the reply was cut off: stopped, or failed part-way. */
  finish?: 'complete' | 'outputLimit';
}

export interface ToolResult {
  callId: string;
  content: string;
  isError?: boolean;
}

export interface ToolResultsMessageBody {
  type: 'toolResults';
  results: ToolResult[];
}

/** Written before a run on a different template from the last one. */
export interface TemplateSwitchedMessageBody {
  type: 'templateSwitched';
  templateId: string;
  label: string;
  previousId?: string;
}

/**
 * Why a run ended before the model finished: a stop layer, the provider (`connection`
 * once retries ran out, `providerError` when retrying couldn't help), Mosaic itself, or
 * the user's Stop.
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
 * Written when a run stops; for the user, never sent to the model. It holds what happened,
 * never wording: the pane decides how each stop reads.
 */
export interface RunStoppedMessageBody {
  type: 'runStopped';
  reason: RunStopReason;
  /** The refusal a stop layer counted, or Mosaic's own error. */
  detail?: string;
  /** The provider's error as it came, for `connection` and `providerError`. */
  providerError?: ModelProviderError;
  /** Requests made for the step that failed, and the time spent waiting between them. */
  attempts?: number;
  waitedMs?: number;
}

export type MessageBody =
  | UserMessageBody
  | AssistantMessageBody
  | ToolResultsMessageBody
  | TemplateSwitchedMessageBody
  | RunStoppedMessageBody;

/** Thinking shows how long, never what: its text and provider state stay in main. */
export type TranscriptReplyPart =
  | Exclude<ModelReplyPart, { type: 'reasoning' }>
  | { type: 'reasoning'; durationMs: number };

/**
 * A body as the transcript reads it. Tool results come without their content, which can
 * be large and shows only when the Trace view opens one.
 */
export type TranscriptMessageBody =
  | Exclude<MessageBody, AssistantMessageBody | ToolResultsMessageBody>
  | (Omit<AssistantMessageBody, 'content'> & { content: TranscriptReplyPart[] })
  | { type: 'toolResults'; results: Omit<ToolResult, 'content'>[] };

/** As the run recorded them when it started. */
export interface RunModel {
  provider: string;
  model: string;
}

export interface TranscriptMessage {
  id: number;
  seq: number;
  /** Null for one written outside a run. */
  runId: number | null;
  /** The provider and model its run used, which a stop's notice names; null outside a run. */
  runModel: RunModel | null;
  body: TranscriptMessageBody;
  createdAt: number;
}
