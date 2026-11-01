import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptMessage } from '@shared/types/agentConversation';
import {
  catchUpConversation,
  openConversation,
  openLastConversation,
  openLeftConversation,
  openSentConversation,
  readNewerMessages,
  readOlderMessages,
  returnToNewest,
  startNewConversation,
  useConversationStore,
} from '../conversationStore';
import { useUiStore } from '../uiStore';
import { createFakeAgentLog, replyBody, userBody } from './fakeAgentLog';

// Where the pane was left is a setting; here it keeps nothing.
vi.mock('@/lib/services/settingsStorage', () => ({
  settingsStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

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
        readConversationTitle: async () => 'Tighten my bullets.',
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

  it('opens where the pane was left, a new conversation included', async () => {
    addRun(1, 1, 2);
    addRun(2, 2, 2);
    await openConversation(2);
    expect(useUiStore.getState().agentPaneConversation).toBe(2);
    await openLeftConversation();
    expect(shown().conversationId).toBe(2);

    startNewConversation();
    expect(useUiStore.getState().agentPaneConversation).toBe('new');
    await openLeftConversation();
    expect(shown().conversationId).toBeNull();

    useUiStore.getState().setAgentPaneConversation(9);
    await openLeftConversation();
    expect(shown()).toEqual({ conversationId: null, seqs: [], hasOlder: false });
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

  describe('the window it holds', () => {
    /** 300 runs of 4 messages, 1,200 in all, opened on the newest. */
    async function openLongConversation() {
      for (let runId = 1; runId <= 300; runId++) addRun(1, runId, 4);
      await openConversation(1);
    }

    const held = () => useConversationStore.getState();

    it('drops the newest whole runs once a fifth page of older ones arrives', async () => {
      await openLongConversation();
      for (let page = 0; page < 3; page++) await readOlderMessages();
      expect(held().messages.at(-1)?.seq).toBe(1200);
      expect(held().hasNewer).toBe(false);

      await readOlderMessages();
      expect(held().messages).toHaveLength(400);
      expect(held().messages[0].seq).toBe(721);
      expect(held().messages.at(-1)?.seq).toBe(1120);
      expect(held().hasNewer).toBe(true);
    });

    it('reads back down to the newest, dropping the oldest, and is at the end again', async () => {
      await openLongConversation();
      for (let page = 0; page < 4; page++) await readOlderMessages();

      await readNewerMessages();
      expect(held().messages.at(-1)?.seq).toBe(1200);
      expect(held().messages[0].seq).toBe(801);
      expect(held().hasOlder).toBe(true);
      expect(held().hasNewer).toBe(false);
    });

    it('never cuts a run in two at either end', async () => {
      addRun(1, 1, 450);
      addRun(1, 2, 2);
      await openConversation(1);
      await readOlderMessages();
      for (let page = 0; page < 3; page++) await readOlderMessages();
      expect(held().messages.at(0)?.runId).toBe(1);
      const lastRunId = held().messages.at(-1)?.runId;
      const lastSeq = held().messages.at(-1)?.seq;
      expect(lastRunId === 2 || lastSeq === 450).toBe(true);
    });

    it('leaves a run’s writing for the way back down while the window is back', async () => {
      await openLongConversation();
      for (let page = 0; page < 4; page++) await readOlderMessages();
      const before = held().messages;
      addRun(1, 301, 2);

      await catchUpConversation(1);
      expect(held().messages).toBe(before);
    });

    it('goes back to the newest for a send, and says so', async () => {
      await openLongConversation();
      for (let page = 0; page < 4; page++) await readOlderMessages();
      const returns = held().returnsToNewest;
      addRun(1, 301, 2);

      await openSentConversation(1);
      expect(held().messages.at(-1)?.seq).toBe(1202);
      expect(held().hasNewer).toBe(false);
      expect(held().returnsToNewest).toBe(returns + 1);
    });

    it('keeps the log’s last run beside the window, up to date as runs end', async () => {
      await openLongConversation();
      for (let page = 0; page < 4; page++) await readOlderMessages();
      expect(held().lastRun.map((message) => message.seq)).toEqual(seqsFrom(1197, 1200));

      addRun(1, 301, 2);
      await catchUpConversation(1);
      expect(held().lastRun.map((message) => message.seq)).toEqual([1201, 1202]);

      startNewConversation();
      expect(held().lastRun).toEqual([]);
    });

    it('goes back to the newest when asked, as a send does', async () => {
      await openLongConversation();
      for (let page = 0; page < 4; page++) await readOlderMessages();
      const returns = held().returnsToNewest;

      await returnToNewest(1);
      expect(held().messages.at(-1)?.seq).toBe(1200);
      expect(held().hasNewer).toBe(false);
      expect(held().returnsToNewest).toBe(returns + 1);
    });

    it('keeps to the window as a run adds to the end', async () => {
      await openLongConversation();
      for (let page = 0; page < 3; page++) await readOlderMessages();
      addRun(1, 301, 120);

      await catchUpConversation(1);
      expect(held().messages.at(-1)?.seq).toBe(1320);
      expect(held().messages.length).toBeLessThanOrEqual(400);
      expect(held().hasOlder).toBe(true);
    });
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
