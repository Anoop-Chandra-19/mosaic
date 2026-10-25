import {
  ipcMain,
  net,
  type IpcMainInvokeEvent,
  type WebContents,
  type WebContentsDidStartNavigationEventParams,
} from 'electron';
import type { Database } from 'better-sqlite3';
import {
  AGENT_CHANNELS,
  AGENT_EVENT,
  AGENT_TOOL_ANSWER,
  AGENT_TOOL_CALL,
} from '@shared/ipc/agentChannels';
import type { DevSwitches } from '@shared/types/devTools';
import { createAgentRuns, type AgentRuns, type RunPage } from '../agent/agentRuns';
import { createScriptedModelProvider } from '../dev/scriptedModelProvider';
import { createModelProvider } from '../model-providers/createModelProvider';
import type { ApiKeys } from '../secrets/apiKeys';
import { createAgentHandlers } from './agentHandlers';

/** A reload or a page that crashed or closed, never a link within the page. */
function watchPageGone(page: WebContents, onGone: () => void): () => void {
  const onNavigation = ({
    isMainFrame,
    isSameDocument,
  }: WebContentsDidStartNavigationEventParams) => {
    if (isMainFrame && !isSameDocument) onGone();
  };
  page.on('did-start-navigation', onNavigation);
  page.on('render-process-gone', onGone);
  page.on('destroyed', onGone);
  return () => {
    page.off('did-start-navigation', onNavigation);
    page.off('render-process-gone', onGone);
    page.off('destroyed', onGone);
  };
}

/** A run's events and calls go to the page that started it, while it is there. */
function runPage(page: WebContents): RunPage {
  const send = (channel: string, payload: unknown) => {
    if (!page.isDestroyed()) page.send(channel, payload);
  };
  return {
    sendEvent: (envelope) => send(AGENT_EVENT, envelope),
    sendToolCall: (call) => send(AGENT_TOOL_CALL, call),
    watchGone: (onGone) => watchPageGone(page, onGone),
  };
}

/**
 * Answer the preload's `agent` calls, from the app's own page only. Returns the runs, which
 * Erase stops before the database goes. In development, the Scripted model switch
 * (`readDevSwitches`) puts the scripted model in place of the chosen provider.
 */
export function registerAgentHandlers(
  currentDb: () => Database | undefined,
  apiKeys: ApiKeys,
  isAppFrame: (event: IpcMainInvokeEvent) => boolean,
  readDevSwitches: (() => DevSwitches) | null
): AgentRuns {
  const openDb = () => {
    const db = currentDb();
    if (!db) throw new Error('The database is closed');
    return db;
  };
  const runs = createAgentRuns({
    currentDb: openDb,
    createProvider: async (choice) =>
      readDevSwitches?.().scriptedModel
        ? { ok: true, modelProvider: createScriptedModelProvider() }
        : createModelProvider(choice, { fetch: net.fetch, readApiKey: apiKeys.read }),
  });
  const handlers = createAgentHandlers(runs, openDb);
  const handle = (
    channel: string,
    answer: (event: IpcMainInvokeEvent, args: unknown[]) => unknown
  ) =>
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isAppFrame(event)) throw new Error(`Refused ${channel} from ${event.senderFrame?.url}`);
      return answer(event, args);
    });

  handle(AGENT_CHANNELS.start, (event, [request]) =>
    handlers.start(runPage(event.sender), request)
  );
  handle(AGENT_CHANNELS.carryOn, (event, [request]) =>
    handlers.carryOn(runPage(event.sender), request)
  );
  handle(AGENT_CHANNELS.stop, (_event, [runId]) => handlers.stop(runId));
  handle(AGENT_CHANNELS.readMessages, (_event, [conversationId, page]) =>
    handlers.readMessages(conversationId, page)
  );
  handle(AGENT_TOOL_ANSWER, (_event, [runId, callId, answer]) =>
    handlers.answerTool(runId, callId, answer)
  );
  return runs;
}
