import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openConversation, useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { useSecretsStore } from '@/stores/secretsStore';
import type { AgentRunEnvelope } from '@shared/types/agentBridge';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { SecretsStatus } from '@shared/types/secrets';
import { createFakeAgentLog, replyBody, userBody } from '@/stores/__tests__/fakeAgentLog';
import { buildRunView } from '../run-view/buildRunView';
import { followAgentRuns } from '../followAgentRuns';

// Where the pane was left is a setting; here it keeps nothing.
vi.mock('@/lib/services/settingsStorage', () => ({
  settingsStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

const REFUSED_KEY: SecretsStatus = {
  keychain: 'available',
  saved: { openai: { where: 'keychain', savedAt: 1, checkedAt: 1, refusedAt: 2 } },
};

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
      secrets: { status: async () => REFUSED_KEY },
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

  it('reads the saved keys again at its end, since it may have found one refused', async () => {
    useSecretsStore.setState({ status: null });
    send({ type: 'stepStarted', step: 1 });
    expect(useSecretsStore.getState().status).toBeNull();

    send({ type: 'runEnded', stopReason: 'providerError' });
    await vi.waitFor(() => expect(useSecretsStore.getState().status).toEqual(REFUSED_KEY));
  });
});
