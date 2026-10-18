import type { ModelReplyPart } from './modelReply';

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

export type MessageBody =
  | UserMessageBody
  | AssistantMessageBody
  | ToolResultsMessageBody
  | TemplateSwitchedMessageBody;

/**
 * A body as the transcript reads it. Tool results come without their content, which can
 * be large and shows only when the Trace view opens one.
 */
export type TranscriptMessageBody =
  | Exclude<MessageBody, ToolResultsMessageBody>
  | { type: 'toolResults'; results: Omit<ToolResult, 'content'>[] };

export interface TranscriptMessage {
  id: number;
  seq: number;
  /** Null for one written outside a run. */
  runId: number | null;
  body: TranscriptMessageBody;
  createdAt: number;
}
