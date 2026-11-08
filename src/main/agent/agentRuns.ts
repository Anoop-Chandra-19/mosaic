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
import { deleteConversation } from '../db/conversations/conversations';
import type { ConversationRun } from '../db/conversations/runs';
import type { ModelChoice, ModelProviderOpening } from '../model-providers/createModelProvider';
import type { ModelProvider } from '../model-providers/modelProvider';
import type { Wait } from './abortableWaits';
import { createIpcToolBridge, type IpcToolBridge } from './ipcToolBridge';
import { readModelChoice } from './readModelChoice';
import { startAgentRun, type AgentAsk, type AgentRunEnd } from './startAgentRun';

/*
 * Manages one assistant run at a time. Reads the selected model (`readModelChoice.ts`),
 * starts the run (`startAgentRun.ts`), and routes numbered events and tool calls to the
 * renderer (`ipcToolBridge.ts`). Stops the run when the renderer reloads or closes.
 * IPC handlers and data erasure use this file; IPC also uses `readOutdatedReads.ts` for
 * Trace read status. The remaining files implement the run's internal steps.
 */

/** The renderer that receives run events and executes tool calls. */
export interface RunPage {
  sendEvent(envelope: AgentRunEnvelope): void;
  sendToolCall(call: AgentToolCall): void;
  /**
   * Calls `onGone` when the renderer reloads or closes because tool execution requires
   * that renderer. Returns an unsubscribe function.
   */
  watchGone(onGone: () => void): () => void;
}

export interface AgentRunsNeeds {
  /** Read at each start because data erasure replaces the database connection. */
  currentDb: () => Database;
  createProvider: (choice: ModelChoice) => Promise<ModelProviderOpening>;
  /** Reports whether the run's API key was refused or the run completed successfully. */
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
   * Cancels any pending start and stops the active run. Resolves after the provider
   * finishes opening and the active run's end is stored.
   */
  stopAll(): Promise<void>;
  /** Stops this conversation's active run, waits for its end to be stored, then deletes it. */
  deleteConversation(conversationId: number): Promise<void>;
}

interface ActiveRun {
  runId: number;
  conversationId: number;
  stop: AbortController;
  bridge: IpcToolBridge;
  ended: Promise<void>;
}

/** Tracks cancellation while provider creation waits, possibly on a keychain prompt. */
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

/** Only a key refusal or successful completion establishes the key's status. */
function readKeyAnswer({ stopReason, providerErrorReason }: AgentRunEnd): KeyAnswer | null {
  if (providerErrorReason === 'keyRefused') return 'refused';
  return stopReason === undefined ? 'worked' : null;
}

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
    // Data erasure cancelled this start while provider creation was pending.
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
          // The fault is already stored; notify the renderer that the run ended.
          console.error('The assistant’s run failed:', error);
          onEvent({ type: 'runEnded', stopReason: 'appFault' }, run);
        }
      )
      .finally(() => {
        stopWatchingPage();
        bridge.close();
        active = null;
      });
    active = { runId: run.runId, conversationId: run.conversationId, stop, bridge, ended };
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
    deleteConversation: async (conversationId) => {
      if (active?.conversationId === conversationId) {
        active.stop.abort();
        await active.ended;
      }
      deleteConversation(needs.currentDb(), conversationId);
    },
  };
}
