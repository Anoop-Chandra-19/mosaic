import { create } from 'zustand';
import { agentService } from '@/lib/services/agentService';
import type { TranscriptMessage } from '@shared/types/agentConversation';
import { useUiStore } from './uiStore';

/*
 * The conversation open in the pane and the part of its log read so far, oldest first.
 * The log is read in pages, never whole: the newest page on opening, older ones as the
 * user scrolls back, and what a run in it wrote as it starts and once it ends. Only a send
 * moves the pane to another conversation; a run elsewhere never does. Where the pane was
 * left (`uiStore`'s `agentPaneConversation`) is where it opens next launch. Reads go one at a
 * time, and one that finishes after the pane moved on is dropped.
 */

/** Longer than any run, which takes about two messages a step. */
export const MESSAGE_PAGE_SIZE = 100;
const OLDER_MESSAGES_AT_ONCE = 8;

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
  agentService.readMessages(conversationId, {
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

/** Shows a conversation, or a new one, and remembers it as where the pane was left. */
function showConversation(conversationId: number | null): void {
  useConversationStore.setState({ conversationId, messages: [], hasOlder: false });
  useUiStore.getState().setAgentPaneConversation(conversationId ?? 'new');
}

/** Opens a conversation on its newest page. */
export function openConversation(conversationId: number): Promise<void> {
  showConversation(conversationId);
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
  const conversationId = await agentService.readLastConversationId();
  if (conversationId === null) startNewConversation();
  else await openConversation(conversationId);
}

/**
 * Opens where the pane was left, a new conversation included. Before it has been left
 * anywhere, the conversation used last; one no longer there gives way to a new one.
 */
export async function openLeftConversation(): Promise<void> {
  const left = useUiStore.getState().agentPaneConversation;
  if (left === null) return openLastConversation();
  if (left === 'new') return startNewConversation();
  await openConversation(left);
  if (isOpen(left) && useConversationStore.getState().messages.length === 0) {
    startNewConversation();
  }
}

let hasOpenedPane = false;

/** The first time the pane shows in a session; after that it keeps its place. */
export function openPaneConversation(): Promise<void> {
  if (hasOpenedPane) return Promise.resolve();
  hasOpenedPane = true;
  return openLeftConversation();
}

/** The next run starts a new conversation. */
export function startNewConversation(): void {
  showConversation(null);
}

/**
 * Adds a page above what is shown a few messages at a time, newest first, with a task between
 * for the browser to paint and take input: a whole page of replies at once blocks it for
 * longer than a slow computer should feel.
 */
async function landOlderMessages(conversationId: number, page: TranscriptMessage[]) {
  for (let end = page.length; end > 0; end -= OLDER_MESSAGES_AT_ONCE) {
    if (!isOpen(conversationId)) return;
    const landing = page.slice(Math.max(0, end - OLDER_MESSAGES_AT_ONCE), end);
    useConversationStore.setState((state) => ({ messages: [...landing, ...state.messages] }));
    await new Promise((resolve) => setTimeout(resolve));
  }
}

let isReadingOlder = false;

/**
 * The page before the oldest message read so far. Scrolling asks far more often than it can be
 * answered, so one already under way is the answer.
 */
export async function readOlderMessages(): Promise<void> {
  if (isReadingOlder) return;
  isReadingOlder = true;
  try {
    await readInTurn(async () => {
      const { conversationId, messages, hasOlder } = useConversationStore.getState();
      if (conversationId === null || !hasOlder || messages.length === 0) return;
      const page = await readPage(conversationId, messages[0].seq);
      await landOlderMessages(conversationId, page.messages);
      if (isOpen(conversationId)) useConversationStore.setState({ hasOlder: page.hasOlder });
    });
  } finally {
    isReadingOlder = false;
  }
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
