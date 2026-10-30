import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openConversation, useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import type { AgentRunEnvelope } from '@shared/types/agentBridge';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import { createFakeAgentLog, replyBody, userBody } from '@/stores/__tests__/fakeAgentLog';
import { buildRunView } from '../transcript/buildRunView';
import { followAgentRuns } from '../followAgentRuns';

// Where the pane was left is a setting; here it keeps nothing.
vi.mock('@/lib/services/settingsStorage', () => ({
  settingsStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

let log: ReturnType<typeof createFakeAgentLog>;
let follow: (envelope: AgentRunEnvelope) => void;
let stopFollowing: () => void;
let seq: number;

beforeEach(() => {
  log = createFakeAgentLog();
  seq = 0;
  vi.stubGlobal('window', {
    mosaic: {
      agent: {
        readMessages: log.readMessages,
        onEvent: (given: typeof follow) => {
          follow = given;
          return () => {};
        },
      },
    },
  });
  useRunStore.setState({ live: null });
  stopFollowing = followAgentRuns();
});

afterEach(() => {
  stopFollowing();
  vi.unstubAllGlobals();
});

const send = (event: AgentRunEvent) => follow({ conversationId: 1, runId: 2, seq: ++seq, event });

const shownRuns = () => buildRunView(useConversationStore.getState().messages);

describe('following a run', () => {
  it('shows the ask as the run starts, and folds the live run into the stored one at its end', async () => {
    log.append(1, 1, userBody('Hello.'));
    log.append(1, 1, replyBody('Hi.'));
    await openConversation(1);

    log.append(1, 2, userBody('Tighten my bullets.'));
    send({ type: 'stepStarted', step: 1 });
    send({ type: 'textDelta', text: 'Done.' });
    await vi.waitFor(() => expect(shownRuns().at(-1)?.ask).toBe('Tighten my bullets.'));
    expect(shownRuns().at(-1)?.parts).toEqual([]);
    expect(useRunStore.getState().live?.parts).toEqual([{ type: 'text', text: 'Done.' }]);

    log.append(1, 2, replyBody('Done.'));
    send({ type: 'runEnded' });
    expect(useRunStore.getState().live?.hasEnded).toBe(true);

    await vi.waitFor(() => expect(useRunStore.getState().live).toBeNull());
    expect(shownRuns().at(-1)?.parts).toEqual([{ type: 'text', text: 'Done.' }]);
  });
});
