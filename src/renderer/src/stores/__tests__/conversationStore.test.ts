import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptMessage } from '@shared/types/agentConversation';
import {
  catchUpConversation,
  openConversation,
  openLastConversation,
  openSentConversation,
  readOlderMessages,
  startNewConversation,
  useConversationStore,
} from '../conversationStore';
import { createFakeAgentLog, replyBody, userBody } from './fakeAgentLog';

let log: ReturnType<typeof createFakeAgentLog>;
let lastConversationId: number | null;

beforeEach(() => {
  log = createFakeAgentLog();
  lastConversationId = 1;
  vi.stubGlobal('window', {
    mosaic: {
      agent: {
        readMessages: log.readMessages,
        readLastConversationId: async () => lastConversationId,
      },
    },
  });
  startNewConversation();
});

afterEach(() => vi.unstubAllGlobals());

/** A run of `count` messages: the ask, then replies. */
function addRun(conversationId: number, runId: number, count: number): void {
  log.append(conversationId, runId, userBody(`Ask ${runId}`));
  for (let i = 1; i < count; i++) log.append(conversationId, runId, replyBody(`Reply ${i}`));
}

const shown = () => {
  const { conversationId, messages, hasOlder } = useConversationStore.getState();
  return { conversationId, seqs: messages.map((message) => message.seq), hasOlder };
};

const seqsFrom = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, i) => first + i);

describe('reading the conversation in pages', () => {
  it('opens the last one on its newest page, whole runs only, then reads back', async () => {
    addRun(1, 1, 30);
    addRun(1, 2, 90);

    await openLastConversation();
    expect(shown()).toEqual({ conversationId: 1, seqs: seqsFrom(31, 120), hasOlder: true });

    await readOlderMessages();
    expect(shown()).toEqual({ conversationId: 1, seqs: seqsFrom(1, 120), hasOlder: false });
  });

  it('starts a new conversation before the first run', async () => {
    lastConversationId = null;
    await openLastConversation();
    expect(shown()).toEqual({ conversationId: null, seqs: [], hasOlder: false });
  });

  it('catches up on what a run wrote, however many pages it took', async () => {
    addRun(1, 1, 2);
    await openConversation(1);
    addRun(1, 2, 150);

    await catchUpConversation(1);
    expect(shown().seqs).toEqual(seqsFrom(1, 152));
    expect(log.readMessages).toHaveBeenCalledTimes(3);
  });

  it('moves to another conversation for a send, never for a run elsewhere', async () => {
    addRun(2, 1, 2);
    await catchUpConversation(2);
    expect(shown()).toEqual({ conversationId: null, seqs: [], hasOlder: false });

    await openSentConversation(2);
    expect(shown()).toEqual({ conversationId: 2, seqs: [1, 2], hasOlder: false });
  });

  it('drops a read that finishes after the pane moved on', async () => {
    addRun(1, 1, 2);
    const page = await log.readMessages(1, { limit: 100 });
    let finishRead: (page: TranscriptMessage[]) => void = () => {};
    log.readMessages.mockImplementationOnce(() => new Promise((resolve) => (finishRead = resolve)));

    const opening = openConversation(1);
    startNewConversation();
    await vi.waitFor(() => expect(log.readMessages).toHaveBeenCalledTimes(2));
    finishRead(page);
    await opening;

    expect(shown()).toEqual({ conversationId: null, seqs: [], hasOlder: false });
  });
});
