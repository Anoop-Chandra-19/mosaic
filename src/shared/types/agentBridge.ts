import type { AgentToolResult } from '../agent-tools/agentTools';
import type {
  RunModel,
  RunStoppedMessageBody,
  ToolResult,
  TranscriptMessage,
} from './agentConversation';
import type { AgentRunEvent } from './agentRunEvents';

/** High limit intended only to guard against oversized pastes. */
export const MAX_AGENT_MESSAGE_LENGTH = 100_000;

/** A user message and its conversation; a null conversation ID starts a new conversation. */
export interface AgentStartRequest {
  conversationId: number | null;
  text: string;
  /** The template open when the message was sent; null if none was open. */
  templateId: string | null;
}

/** Continues from the conversation's log without a new message, for "Send again". */
export interface AgentCarryOnRequest {
  conversationId: number;
  templateId: string | null;
}

/**
 * `noApiKey`: no key is saved for the provider selected in Settings. `keychainRefused`:
 * the keychain holds the key but denied access (locked, or its prompt was declined).
 */
export type ModelProviderRefusal = 'noApiKey' | 'keychainRefused';

/** `assistantOff`: the assistant is off in Settings. `runInProgress`: one run at a time. */
export type AgentStartRefusal = 'assistantOff' | 'runInProgress' | ModelProviderRefusal;

export type AgentStart =
  | { ok: true; conversationId: number; runId: number }
  | { ok: false; reason: AgentStartRefusal };

export interface MessagePage {
  /** The page ends just before this message; absent for the newest page. */
  beforeSeq?: number;
  limit: number;
}

/** Conversation list data; the renderer supplies the display text. */
export interface ConversationSummary {
  id: number;
  /** The start of the first user message; null if there is no text to use. */
  title: string | null;
  lastActiveAt: number;
  /** Names of existing resumes its runs worked on, most recently used first. */
  resumes: string[];
  /** How the last run stopped, if the log ends with that stop message. */
  stop: { body: RunStoppedMessageBody; runModel: RunModel } | null;
}

/** Conversations are ordered by most recent activity; each page continues from the previous one. */
export interface ConversationPage {
  /** The page starts just after this conversation; absent for the first page. */
  after?: { lastActiveAt: number; id: number };
  limit: number;
}

/** Identifies the run and numbers its events from 1 so subscribers can distinguish runs. */
export interface AgentRunEnvelope {
  conversationId: number;
  runId: number;
  seq: number;
  event: AgentRunEvent;
}

/** A tool call sent by main for the renderer to execute. */
export interface AgentToolCall {
  runId: number;
  callId: string;
  name: string;
  args: unknown;
}

/** The renderer's answer to a tool call; `ok: false` if execution threw. */
export type AgentToolAnswer =
  | { ok: true; result: AgentToolResult }
  | { ok: false; message: string };

/**
 * Why a read is outdated: the model was told to read again, the draft changed without
 * that instruction, or another resume is open.
 */
export type ReadOutcome = 'askedAgain' | 'edited' | 'otherResume';

export interface OutdatedRead {
  runId: number;
  callId: string;
  outcome: ReadOutcome;
}

/**
 * `window.mosaic.agent`: assistant runs execute in main. The renderer starts and stops
 * runs, subscribes to their events, reads the log in pages, and executes tool calls
 * because it owns the draft and suggestions.
 */
export interface MosaicAgent {
  start(request: AgentStartRequest): Promise<AgentStart>;
  carryOn(request: AgentCarryOnRequest): Promise<AgentStart>;
  /** Stops the run if it is still going; its end is stored as `cancelled`. */
  stop(runId: number): Promise<void>;
  readMessages(conversationId: number, page: MessagePage): Promise<TranscriptMessage[]>;
  /** A full tool result, omitted from message pages. `messageId` identifies the message containing it. */
  readToolResult(messageId: number, callId: string): Promise<ToolResult>;
  /** The conversation's outdated reads, compared with the current draft of `templateId`. */
  readOutdatedReads(conversationId: number, templateId: string | null): Promise<OutdatedRead[]>;
  /** The last used conversation, opened by the pane; null before the first run. */
  readLastConversationId(): Promise<number | null>;
  readConversations(page: ConversationPage): Promise<ConversationSummary[]>;
  readConversationTitle(conversationId: number): Promise<string | null>;
  /** Stops the conversation's active run, if any, then permanently deletes the conversation from disk. */
  deleteConversation(conversationId: number): Promise<void>;
  /** Subscribes to all runs' events; returns an unsubscribe function. */
  onEvent(follow: (envelope: AgentRunEnvelope) => void): () => void;
  /** Registers the renderer's only tool runner; returns a function to unregister it. */
  onToolCall(run: (call: AgentToolCall) => Promise<AgentToolResult>): () => void;
}
