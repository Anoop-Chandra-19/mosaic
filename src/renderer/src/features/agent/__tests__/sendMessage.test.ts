import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentNoticeStore, type NoticeSource } from '@/stores/agentNoticeStore';
import { startNewConversation, useConversationStore } from '@/stores/conversationStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useRunStore } from '@/stores/runStore';
import type { AgentStart } from '@shared/types/agentBridge';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import { createFakeAgentLog, userBody } from '@/stores/__tests__/fakeAgentLog';
import { makeResume } from '../../suggestions/proposals/__tests__/proposalFixtures';
import { canSendMessage, sendMessage } from '../sendMessage';

// Where the pane was left is a setting; here it keeps nothing.
vi.mock('@/lib/services/settingsStorage', () => ({
  settingsStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

let log: ReturnType<typeof createFakeAgentLog>;
let start: AgentStart;

beforeEach(() => {
  log = createFakeAgentLog();
  vi.stubGlobal('window', {
    mosaic: {
      agent: {
        start: vi.fn(async () => start),
        readMessages: log.readMessages,
        readConversationTitle: async () => 'Tighten my summary.',
        onEvent: () => () => {},
      },
    },
  });
  useResumeStore.getState().loadDraft({ templateId: 't1', doc: makeResume(), rev: 3 });
  startNewConversation();
});

afterEach(() => vi.unstubAllGlobals());

describe('sending from the prompt box', () => {
  it('sends only words, and never while a run is going', () => {
    expect(canSendMessage('Tighten my bullets.', false)).toBe(true);
    expect(canSendMessage(' \n ', false)).toBe(false);
    expect(canSendMessage('Tighten my bullets.', true)).toBe(false);
  });

  it('opens the conversation a first message starts', async () => {
    start = { ok: true, conversationId: 7, runId: 1 };
    log.append(7, 1, userBody('Tighten my bullets.'));

    expect(await sendMessage('  Tighten my bullets.\n', null)).toBe(true);
    expect(window.mosaic.agent.start).toHaveBeenCalledWith({
      conversationId: null,
      text: 'Tighten my bullets.',
      templateId: 't1',
    });
    expect(useConversationStore.getState()).toMatchObject({
      conversationId: 7,
      messages: [{ seq: 1 }],
    });
  });

  it('says why main didn’t start it, and stays where it was', async () => {
    start = { ok: false, reason: 'noApiKey' };
    expect(await sendMessage('Tighten my bullets.', null)).toBe(false);
    expect(useAgentNoticeStore.getState().refusal).toMatchObject({
      conversationId: null,
      reason: 'noApiKey',
    });
    expect(useConversationStore.getState().conversationId).toBeNull();
  });

  describe('a send made while a notice showed', () => {
    const answering: NoticeSource = { type: 'run', runId: 4 };
    const followRun = (event: AgentRunEvent) =>
      useRunStore.getState().followRunEvent({ conversationId: 7, runId: 5, seq: 0, event });

    beforeEach(() => {
      vi.useFakeTimers();
      useRunStore.setState({ live: null });
      start = { ok: true, conversationId: 7, runId: 5 };
    });
    afterEach(() => vi.useRealTimers());

    it('holds the notice a few seconds, then lets go of a run that is still silent', async () => {
      await sendMessage('Tighten my bullets.', answering);
      followRun({ type: 'stepStarted', step: 1 });

      vi.advanceTimersByTime(4999);
      expect(useAgentNoticeStore.getState().resend).toMatchObject({ runId: 5 });
      vi.advanceTimersByTime(1);
      expect(useAgentNoticeStore.getState().resend).toBeNull();
    });

    it('keeps what it needs to answer a run that ended in time', async () => {
      await sendMessage('Tighten my bullets.', answering);
      followRun({ type: 'runEnded', stopReason: 'providerError' });

      vi.advanceTimersByTime(5000);
      expect(useAgentNoticeStore.getState().resend).toMatchObject({ runId: 5 });
    });
  });
});
