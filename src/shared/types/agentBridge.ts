import type { AgentToolResult } from '../agent-tools/agentTools';
import type {
  RunModel,
  RunStoppedMessageBody,
  ToolResult,
  TranscriptMessage,
} from './agentConversation';
import type { AgentRunEvent } from './agentRunEvents';

/** Longer than any ask; it only stops a runaway paste. */
export const MAX_AGENT_MESSAGE_LENGTH = 100_000;

/** What the user sent, on the conversation they sent it in: null starts a new one. */
export interface AgentStartRequest {
  conversationId: number | null;
  text: string;
  /** The template open when it was sent; null with none open. */
  templateId: string | null;
}

/** Carry on from the conversation's log with no new message: the design's Send again. */
export interface AgentCarryOnRequest {
  conversationId: number;
  templateId: string | null;
}

/**
 * `noApiKey`: no key is saved for the provider Settings names. `keychainRefused`: the
 * keychain holds the key but wouldn't give it back (locked, or its prompt was turned down).
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

/** A conversation in the list, as facts: the page words them. */
export interface ConversationSummary {
  id: number;
  /** The start of the first thing asked; null if it has no words. */
  title: string | null;
  lastActiveAt: number;
  /** The resumes its runs worked on and that still exist, last worked on first. */
  resumes: string[];
  /** How its last run stopped, if that is the last thing in its log. */
  stop: { body: RunStoppedMessageBody; runModel: RunModel } | null;
}

/** Most recently active first, so a page carries on from the last one's place in that order. */
export interface ConversationPage {
  /** The page starts just after this conversation; absent for the first page. */
  after?: { lastActiveAt: number; id: number };
  limit: number;
}

/** A run's event, numbered from 1 within the run, so a follower can tell runs apart. */
export interface AgentRunEnvelope {
  conversationId: number;
  runId: number;
  seq: number;
  event: AgentRunEvent;
}

/** A tool call main sends the page to run. */
export interface AgentToolCall {
  runId: number;
  callId: string;
  name: string;
  args: unknown;
}

/** The page's answer to a call; `failed` when running it threw. */
export type AgentToolAnswer =
  | { ok: true; result: AgentToolResult }
  | { ok: false; message: string };

/**
 * What became of a read that no longer holds: the model was told to read again, or nothing has
 * asked it since and the draft has moved on, or another resume is open.
 */
export type ReadOutcome = 'askedAgain' | 'edited' | 'otherResume';

export interface OutdatedRead {
  runId: number;
  callId: string;
  outcome: ReadOutcome;
}

/**
 * `window.mosaic.agent`: the assistant's runs, which happen in main. The page starts and
 * stops them, follows their events, reads the log in pages, and runs the tools a run calls,
 * since the draft and the suggestions live in the page.
 */
export interface MosaicAgent {
  start(request: AgentStartRequest): Promise<AgentStart>;
  carryOn(request: AgentCarryOnRequest): Promise<AgentStart>;
  /** Stops the run if it is still going; its end is stored as `cancelled`. */
  stop(runId: number): Promise<void>;
  readMessages(conversationId: number, page: MessagePage): Promise<TranscriptMessage[]>;
  /** One call's answer in full, which pages leave out. `messageId` is the message holding it. */
  readToolResult(messageId: number, callId: string): Promise<ToolResult>;
  /** The conversation's reads that no longer hold, against the draft of `templateId` now. */
  readOutdatedReads(conversationId: number, templateId: string | null): Promise<OutdatedRead[]>;
  /** The conversation used last, which the pane opens on; null before the first run. */
  readLastConversationId(): Promise<number | null>;
  readConversations(page: ConversationPage): Promise<ConversationSummary[]>;
  /** Stops its run first if one is going. Removes it from the disk, with no way back. */
  deleteConversation(conversationId: number): Promise<void>;
  /** Every run's events; returns the call that stops following them. */
  onEvent(follow: (envelope: AgentRunEnvelope) => void): () => void;
  /** The page's one tool runner; returns the call that removes it. */
  onToolCall(run: (call: AgentToolCall) => Promise<AgentToolResult>): () => void;
}
