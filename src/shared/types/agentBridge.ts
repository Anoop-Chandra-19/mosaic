import type { AgentToolResult } from '../agent-tools/agentTools';
import type { ToolResult, TranscriptMessage } from './agentConversation';
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
  /** The conversation used last, which the pane opens on; null before the first run. */
  readLastConversationId(): Promise<number | null>;
  /** Every run's events; returns the call that stops following them. */
  onEvent(follow: (envelope: AgentRunEnvelope) => void): () => void;
  /** The page's one tool runner; returns the call that removes it. */
  onToolCall(run: (call: AgentToolCall) => Promise<AgentToolResult>): () => void;
}
