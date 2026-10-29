import { create } from 'zustand';
import type { TranscriptMessage } from '@shared/types/agentConversation';

/*
 * The conversation open in the pane and the part of its log read so far, oldest first.
 * The log is read in pages, never whole: the newest page on opening, older ones as the
 * user scrolls back, and what a run in it wrote as it starts and once it ends. Only a send
 * moves the pane to another conversation; a run elsewhere never does. Reads go one at a
 * time, and one that finishes after the pane moved on is dropped.
 */

/** Longer than any run, which takes about two messages a step. */
export const MESSAGE_PAGE_SIZE = 100;

interface ConversationState {
  /** Null for a new conversation, which the first run creates. */
  conversationId: number | null;
  messages: TranscriptMessage[];
  hasOlder: boolean;
}

export const useConversationStore = create<ConversationState>()(() => ({
  conversationId: null,
  messages: [],
  hasOlder: false,
}));

let reading: Promise<void> = Promise.resolve();

/** Runs reads one after another, so two never interleave their pages. */
function readInTurn(read: () => Promise<void>): Promise<void> {
  reading = reading.then(read, read);
  return reading;
}

const isOpen = (conversationId: number) =>
  useConversationStore.getState().conversationId === conversationId;

/**
 * A page that may begin partway through a run: when older messages exist, the first run's
 * messages wait for the next page, so every run is read whole. A run longer than the page
 * is kept as it is.
 */
function keepWholeRuns(page: TranscriptMessage[]): TranscriptMessage[] {
  if (page.length < MESSAGE_PAGE_SIZE) return page;
  const firstRunId = page[0].runId;
  const nextRun = page.findIndex((message) => message.runId !== firstRunId);
  return nextRun > 0 ? page.slice(nextRun) : page;
}

const requestPage = (conversationId: number, beforeSeq: number | undefined) =>
  window.mosaic.agent.readMessages(conversationId, {
    ...(beforeSeq === undefined ? {} : { beforeSeq }),
    limit: MESSAGE_PAGE_SIZE,
  });

async function readPage(conversationId: number, beforeSeq?: number) {
  const page = await requestPage(conversationId, beforeSeq);
  return { messages: keepWholeRuns(page), hasOlder: page.length === MESSAGE_PAGE_SIZE };
}

async function readNewest(conversationId: number): Promise<void> {
  const page = await readPage(conversationId);
  if (isOpen(conversationId)) useConversationStore.setState(page);
}

/** Opens a conversation on its newest page. */
export function openConversation(conversationId: number): Promise<void> {
  useConversationStore.setState({ conversationId, messages: [], hasOlder: false });
  return readInTurn(() => readNewest(conversationId));
}

/**
 * Where the pane goes after a send: the first message of a new conversation created it,
 * so it opens. A send in the open conversation stays put, and its run is caught up on.
 */
export function openSentConversation(conversationId: number): Promise<void> {
  return isOpen(conversationId) ? Promise.resolve() : openConversation(conversationId);
}

/** Opens the conversation used last, or a new one before the first run. */
export async function openLastConversation(): Promise<void> {
  const conversationId = await window.mosaic.agent.readLastConversationId();
  if (conversationId === null) startNewConversation();
  else await openConversation(conversationId);
}

/** The next run starts a new conversation. */
export function startNewConversation(): void {
  useConversationStore.setState({ conversationId: null, messages: [], hasOlder: false });
}

/** The page before the oldest message read so far. */
export function readOlderMessages(): Promise<void> {
  return readInTurn(async () => {
    const { conversationId, messages, hasOlder } = useConversationStore.getState();
    if (conversationId === null || !hasOlder || messages.length === 0) return;
    const page = await readPage(conversationId, messages[0].seq);
    if (!isOpen(conversationId)) return;
    useConversationStore.setState((state) => ({
      messages: [...page.messages, ...state.messages],
      hasOlder: page.hasOlder,
    }));
  });
}

/** Pages back from the newest message until it reaches one already read. */
async function readSince(conversationId: number, lastSeq: number): Promise<TranscriptMessage[]> {
  const newer: TranscriptMessage[] = [];
  let beforeSeq: number | undefined;
  for (;;) {
    const page = await requestPage(conversationId, beforeSeq);
    newer.unshift(...page.filter((message) => message.seq > lastSeq));
    if (page.length < MESSAGE_PAGE_SIZE || page[0].seq <= lastSeq + 1) return newer;
    beforeSeq = page[0].seq;
  }
}

/**
 * Shows what a run has written so far, when its conversation is the open one. A run in
 * another conversation carries on unseen; the pane never moves to it.
 */
export function catchUpConversation(conversationId: number): Promise<void> {
  if (!isOpen(conversationId)) return Promise.resolve();
  return readInTurn(async () => {
    const lastSeq = useConversationStore.getState().messages.at(-1)?.seq;
    if (lastSeq === undefined) return readNewest(conversationId);
    const newer = await readSince(conversationId, lastSeq);
    if (!isOpen(conversationId) || newer.length === 0) return;
    useConversationStore.setState((state) => ({ messages: [...state.messages, ...newer] }));
  });
}
