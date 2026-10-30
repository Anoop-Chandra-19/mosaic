import type { Database } from 'better-sqlite3';
import type { RunLimitSettings } from '@shared/agent/runLimitSettings';
import type {
  AgentCarryOnRequest,
  AgentRunEnvelope,
  AgentStart,
  AgentStartRefusal,
  AgentStartRequest,
  AgentToolAnswer,
  AgentToolCall,
} from '@shared/types/agentBridge';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ConversationRun } from '../db/conversations/runs';
import type { ModelChoice, ModelProviderOpening } from '../model-providers/createModelProvider';
import type { ModelProvider } from '../model-providers/modelProvider';
import type { Wait } from './abortableWaits';
import { createIpcToolBridge, type IpcToolBridge } from './ipcToolBridge';
import { readModelChoice } from './readModelChoice';
import { startAgentRun, type AgentAsk, type AgentRunEnd } from './startAgentRun';

/*
 * The assistant's runs as the page sees them, and this module's entry: one at a time,
 * started with what Settings chose (`readModelChoice.ts`), run by `startAgentRun.ts`,
 * followed through numbered events, stopped on request or when its page goes, with the page
 * running each tool call (`ipcToolBridge.ts`). The IPC handlers and Erase use this file.
 */

/** The page that started a run: where its events and tool calls go. */
export interface RunPage {
  sendEvent(envelope: AgentRunEnvelope): void;
  sendToolCall(call: AgentToolCall): void;
  /**
   * Calls `onGone` if the page reloads or closes, since a run's tools live in it; returns
   * the call that stops watching.
   */
  watchGone(onGone: () => void): () => void;
}

export interface AgentRunsNeeds {
  /** Asked at each start: Erase swaps the connection for a fresh file. */
  currentDb: () => Database;
  createProvider: (choice: ModelChoice) => Promise<ModelProviderOpening>;
  /** What a run's end said about the key it started with. */
  noteKeyAnswer?: (choice: ModelChoice, answer: KeyAnswer, runStartedAt: number) => void;
  limits?: RunLimitSettings;
  wait?: Wait;
}

export type KeyAnswer = 'refused' | 'worked';

export interface AgentRuns {
  start(page: RunPage, request: AgentStartRequest): Promise<AgentStart>;
  carryOn(page: RunPage, request: AgentCarryOnRequest): Promise<AgentStart>;
  stop(runId: number): void;
  answerTool(runId: number, callId: string, answer: AgentToolAnswer): void;
  /**
   * Stops the run if one is going, and settles once its end is stored. A start still
   * waiting for its provider is refused.
   */
  stopAll(): Promise<void>;
}

interface ActiveRun {
  runId: number;
  stop: AbortController;
  bridge: IpcToolBridge;
  ended: Promise<void>;
}

/** A start waiting for its provider, which may wait on a keychain prompt. */
interface PendingStart {
  isCancelled: boolean;
  opened: Promise<ModelProviderOpening>;
}

interface RunSetup {
  db: Database;
  choice: ModelChoice;
  modelProvider: ModelProvider;
  ask: AgentAsk;
  templateId: string | null;
}

const refused = (reason: AgentStartRefusal): AgentStart => ({ ok: false, reason });

/** Only a refusal or a finished run says anything about the key; any other stop may not. */
function readKeyAnswer({ stopReason, providerErrorReason }: AgentRunEnd): KeyAnswer | null {
  if (providerErrorReason === 'keyRefused') return 'refused';
  return stopReason === undefined ? 'worked' : null;
}

/** Numbers each event within its run, from 1. */
function numberEvents(page: RunPage) {
  let seq = 0;
  return (event: AgentRunEvent, run: ConversationRun) =>
    page.sendEvent({ ...run, seq: ++seq, event });
}

export function createAgentRuns(needs: AgentRunsNeeds): AgentRuns {
  let active: ActiveRun | null = null;
  let pending: PendingStart | null = null;

  async function begin(
    page: RunPage,
    ask: AgentAsk,
    templateId: string | null
  ): Promise<AgentStart> {
    if (active || pending) return refused('runInProgress');
    const db = needs.currentDb();
    const choice = readModelChoice(db);
    if (!choice) return refused('assistantOff');
    const start: PendingStart = { isCancelled: false, opened: needs.createProvider(choice) };
    pending = start;
    const opened = await start.opened.finally(() => (pending = null));
    // Erase came while it waited, and leaves the assistant off.
    if (start.isCancelled) return refused('assistantOff');
    if (!opened.ok) return refused(opened.reason);
    return run(page, { db, choice, modelProvider: opened.modelProvider, ask, templateId });
  }

  function run(
    page: RunPage,
    { db, choice, modelProvider, ask, templateId }: RunSetup
  ): AgentStart {
    const stop = new AbortController();
    const bridge = createIpcToolBridge((call) => page.sendToolCall(call));
    const onEvent = numberEvents(page);
    const startedAt = Date.now();
    const run = startAgentRun({
      db,
      ask,
      templateId,
      model: { provider: choice.provider, name: choice.model },
      modelProvider,
      bridge,
      signal: stop.signal,
      onEvent,
      limits: needs.limits,
      wait: needs.wait,
    });
    const stopWatchingPage = page.watchGone(() => stop.abort());
    const ended = run.ended
      .then(
        (end) => {
          const answer = readKeyAnswer(end);
          if (answer) needs.noteKeyAnswer?.(choice, answer, startedAt);
        },
        (error: unknown) => {
          // Already stored as the run's stop; the page still has to hear the run ended.
          console.error('The assistant’s run failed:', error);
          onEvent({ type: 'runEnded', stopReason: 'appFault' }, run);
        }
      )
      .finally(() => {
        stopWatchingPage();
        bridge.close();
        active = null;
      });
    active = { runId: run.runId, stop, bridge, ended };
    return { ok: true, conversationId: run.conversationId, runId: run.runId };
  }

  const activeRun = (runId: number) => (active?.runId === runId ? active : null);

  return {
    start: (page, { conversationId, text, templateId }) =>
      begin(page, { type: 'user', conversationId, text }, templateId),
    carryOn: (page, { conversationId, templateId }) =>
      begin(page, { type: 'carryOn', conversationId }, templateId),
    stop: (runId) => activeRun(runId)?.stop.abort(),
    answerTool: (runId, callId, answer) => activeRun(runId)?.bridge.answer(callId, answer),
    stopAll: async () => {
      if (pending) {
        pending.isCancelled = true;
        await pending.opened.catch(() => {});
      }
      active?.stop.abort();
      await active?.ended;
    },
  };
}
