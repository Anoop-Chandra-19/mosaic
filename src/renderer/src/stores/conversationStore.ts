import { create } from 'zustand';
import { agentService } from '@/lib/services/agentService';
import type { TranscriptMessage } from '@shared/types/agentConversation';
import { useUiStore } from './uiStore';

/*
 * The conversation open in the pane and the window of its log held, oldest first. The log is
 * read in pages, never whole: the newest page on opening, older and newer ones as the user
 * scrolls, and what a run in it wrote as it starts and once it ends. A page past what the
 * window holds drops the messages farthest from it, whole runs at a time; they are safe in
 * the log, and read again when the user comes back. Only a send moves the pane to another
 * conversation; a run elsewhere never does. Where the pane was left (`uiStore`'s
 * `agentPaneConversation`) is where it opens next launch. Reads go one at a time, and one
 * that finishes after the pane moved on is dropped.
 */

/** Longer than any run, which takes about two messages a step. */
export const MESSAGE_PAGE_SIZE = 100;
/** Four pages, so scrolling back and forth near an edge reads and drops nothing. */
const MOST_MESSAGES_HELD = MESSAGE_PAGE_SIZE * 4;
const MESSAGES_LANDING_AT_ONCE = 8;

interface ConversationState {
  /** Null for a new conversation, which the first run creates. */
  conversationId: number | null;
  messages: TranscriptMessage[];
  hasOlder: boolean;
  /** The window has moved back from the end of the log: the newest messages aren't held. */
  hasNewer: boolean;
  /** Rises each time a send puts the user back on the newest, for the pane to scroll there. */
  returnsToNewest: number;
}

export const useConversationStore = create<ConversationState>()(() => ({
  conversationId: null,
  messages: [],
  hasOlder: false,
  hasNewer: false,
  returnsToNewest: 0,
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

/** The same at a page's other end: a run it cuts off waits for the next page. */
function keepWholeRunsAtEnd(page: TranscriptMessage[]): TranscriptMessage[] {
  const lastRunId = page.at(-1)?.runId;
  const lastOfOtherRun = page.findLastIndex((message) => message.runId !== lastRunId);
  return lastOfOtherRun >= 0 ? page.slice(0, lastOfOtherRun + 1) : page;
}

/**
 * The page after a message. A conversation's `seq`s have no gaps, as its log is only ever
 * added to, so that page is the one before `seq + size + 1`; near the end of the log, that
 * reaches back past the message, and what is left is shorter than a page.
 */
async function readPageAfter(conversationId: number, lastSeq: number) {
  const page = await requestPage(conversationId, lastSeq + MESSAGE_PAGE_SIZE + 1);
  const newer = page.filter((message) => message.seq > lastSeq);
  const hasNewer = newer.length === MESSAGE_PAGE_SIZE;
  return { messages: hasNewer ? keepWholeRunsAtEnd(newer) : newer, hasNewer };
}

/** The window's end the messages past the most held would be cut at: never inside a run. */
function dropNewestPastWindow(messages: TranscriptMessage[]): TranscriptMessage[] {
  let end = MOST_MESSAGES_HELD;
  while (end < messages.length && messages[end].runId === messages[end - 1].runId) end++;
  return messages.slice(0, end);
}

function dropOldestPastWindow(messages: TranscriptMessage[]): TranscriptMessage[] {
  let start = Math.max(0, messages.length - MOST_MESSAGES_HELD);
  while (start > 0 && messages[start].runId === messages[start - 1].runId) start--;
  return messages.slice(start);
}

/** What a page or a run leaves too many of goes from the end away from where it landed. */
function trimNewestEnd(): void {
  useConversationStore.setState((state) => {
    const messages = dropNewestPastWindow(state.messages);
    if (messages.length === state.messages.length) return state;
    return { messages, hasNewer: true };
  });
}

function trimOldestEnd(): void {
  useConversationStore.setState((state) => {
    const messages = dropOldestPastWindow(state.messages);
    if (messages.length === state.messages.length) return state;
    return { messages, hasOlder: true };
  });
}

function splitIntoPieces(page: TranscriptMessage[]): TranscriptMessage[][] {
  const pieces: TranscriptMessage[][] = [];
  for (let at = 0; at < page.length; at += MESSAGES_LANDING_AT_ONCE) {
    pieces.push(page.slice(at, at + MESSAGES_LANDING_AT_ONCE));
  }
  return pieces;
}

/**
 * Lands a page a few messages at a time, with a task between for the browser to paint and take
 * input: a whole page of replies at once blocks it for longer than a slow computer should feel.
 */
async function landInPieces(
  conversationId: number,
  pieces: TranscriptMessage[][],
  add: (messages: TranscriptMessage[], piece: TranscriptMessage[]) => TranscriptMessage[]
): Promise<void> {
  for (const piece of pieces) {
    if (!isOpen(conversationId)) return;
    useConversationStore.setState((state) => ({ messages: add(state.messages, piece) }));
    await new Promise((resolve) => setTimeout(resolve));
  }
}

/** A page landing or on its way, which is the answer to scrolling asking for another. */
let isReadingPage = false;

/**
 * Puts the window on the end of the log, whatever it held: what is at the bottom shows first,
 * and the rest of the page lands above it, off screen. That counts as the page being read, or
 * so short a view would be near enough the top to read another at once.
 */
async function readNewest(conversationId: number): Promise<void> {
  const page = await readPage(conversationId);
  if (!isOpen(conversationId)) return;
  const pieces = splitIntoPieces(page.messages).reverse();
  useConversationStore.setState({
    messages: pieces[0] ?? [],
    hasOlder: page.hasOlder,
    hasNewer: false,
  });
  isReadingPage = true;
  try {
    await landInPieces(conversationId, pieces.slice(1), (held, piece) => [...piece, ...held]);
  } finally {
    isReadingPage = false;
  }
}

/** Shows a conversation, or a new one, and remembers it as where the pane was left. */
function showConversation(conversationId: number | null): void {
  useConversationStore.setState({ conversationId, messages: [], hasOlder: false, hasNewer: false });
  useUiStore.getState().setAgentPaneConversation(conversationId ?? 'new');
}

/** Opens a conversation on its newest page. */
export function openConversation(conversationId: number): Promise<void> {
  showConversation(conversationId);
  return readInTurn(() => readNewest(conversationId));
}

/**
 * Where the pane goes after a send: the first message of a new conversation created it,
 * so it opens. A send in the open conversation goes back to its newest, reading it again if
 * the window has moved away, and its run is caught up on.
 */
export function openSentConversation(conversationId: number): Promise<void> {
  if (!isOpen(conversationId)) return openConversation(conversationId);
  return readInTurn(async () => {
    const { hasNewer } = useConversationStore.getState();
    if (hasNewer) await readNewest(conversationId);
    if (!isOpen(conversationId)) return;
    useConversationStore.setState((state) => ({ returnsToNewest: state.returnsToNewest + 1 }));
  });
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

/** Scrolling asks far more often than it can be answered: one under way is the answer. */
async function readOnePage(read: () => Promise<void>): Promise<void> {
  if (isReadingPage) return;
  isReadingPage = true;
  try {
    await readInTurn(read);
  } finally {
    isReadingPage = false;
  }
}

/** The page before the oldest message held, newest of it first, so it builds upward. */
export function readOlderMessages(): Promise<void> {
  return readOnePage(async () => {
    const { conversationId, messages, hasOlder } = useConversationStore.getState();
    if (conversationId === null || !hasOlder || messages.length === 0) return;
    const page = await readPage(conversationId, messages[0].seq);
    await landInPieces(conversationId, splitIntoPieces(page.messages).reverse(), (held, piece) => [
      ...piece,
      ...held,
    ]);
    if (!isOpen(conversationId)) return;
    useConversationStore.setState({ hasOlder: page.hasOlder });
    trimNewestEnd();
  });
}

/** The page after the newest message held, on the way back down to the end of the log. */
export function readNewerMessages(): Promise<void> {
  return readOnePage(async () => {
    const { conversationId, messages, hasNewer } = useConversationStore.getState();
    const lastSeq = messages.at(-1)?.seq;
    if (conversationId === null || !hasNewer || lastSeq === undefined) return;
    const page = await readPageAfter(conversationId, lastSeq);
    await landInPieces(conversationId, splitIntoPieces(page.messages), (held, piece) => [
      ...held,
      ...piece,
    ]);
    if (!isOpen(conversationId)) return;
    useConversationStore.setState({ hasNewer: page.hasNewer });
    trimOldestEnd();
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
 * another conversation carries on unseen; the pane never moves to it. While the window is
 * back from the end of the log there is nothing to add to: the way back down reads it.
 */
export function catchUpConversation(conversationId: number): Promise<void> {
  if (!isOpen(conversationId)) return Promise.resolve();
  return readInTurn(async () => {
    const { messages, hasNewer } = useConversationStore.getState();
    if (hasNewer) return;
    const lastSeq = messages.at(-1)?.seq;
    if (lastSeq === undefined) return readNewest(conversationId);
    const newer = await readSince(conversationId, lastSeq);
    if (!isOpen(conversationId) || newer.length === 0) return;
    useConversationStore.setState((state) => ({ messages: [...state.messages, ...newer] }));
    trimOldestEnd();
  });
}
