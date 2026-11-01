import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentRunEnvelope,
  AgentToolAnswer,
  AgentToolCall,
  MosaicAgent,
} from '@shared/types/agentBridge';
import type { MosaicBackup } from '@shared/types/backup';
import type { MosaicDbBridge } from '@shared/types/dbBridge';
import type { MosaicDev } from '@shared/types/devTools';
import type { MosaicFiles } from '@shared/types/files';
import type { MosaicModelProviders } from '@shared/types/modelProviders';
import type { EraseResult, MosaicSecrets } from '@shared/types/secrets';
import {
  BACKUP_CHANNELS,
  DEV_BUILD_ARGUMENT,
  DEV_CHANNELS,
  DEV_OPEN_TOOLS,
  ERASE_ALL,
  FILES_OPEN,
  FILES_SAVE,
  FLUSH_DONE,
  FLUSH_REQUEST,
  HELP_MENU_COMMAND,
  HELP_MENU_COMMANDS,
  type HelpMenuCommand,
  MODEL_PROVIDERS_CHANNELS,
  SECRETS_CHANNELS,
} from '@shared/ipc/appChannels';
import {
  AGENT_CHANNELS,
  AGENT_EVENT,
  AGENT_TOOL_ANSWER,
  AGENT_TOOL_CALL,
} from '@shared/ipc/agentChannels';
import { DB_METHODS, dbChannel } from '@shared/ipc/dbMethods';

// The only door between the sandboxed renderer and the main process: narrow, typed
// methods — never raw IPC or Node.

/** `db.templates.create(…)` → the `db:templates.create` channel, for each method. */
function dbBridge(): MosaicDbBridge {
  const bridge: Record<string, unknown> = {};
  for (const method of DB_METHODS) {
    const path = method.split('.');
    let node = bridge;
    for (const key of path.slice(0, -1)) {
      node = (node[key] ??= {}) as Record<string, unknown>;
    }
    node[path[path.length - 1]] = (...args: unknown[]) =>
      ipcRenderer.invoke(dbChannel(method), ...args);
  }
  return bridge as unknown as MosaicDbBridge;
}

let flushRegistered = false;
let helpMenuRegistered = false;

const files: MosaicFiles = {
  save: (type, suggestedName, content) =>
    ipcRenderer.invoke(FILES_SAVE, type, suggestedName, content),
  open: (type) => ipcRenderer.invoke(FILES_OPEN, type),
};

const backup: MosaicBackup = {
  status: () => ipcRenderer.invoke(BACKUP_CHANNELS.status),
  backUpNow: () => ipcRenderer.invoke(BACKUP_CHANNELS.backUpNow),
  setFrequency: (frequency) => ipcRenderer.invoke(BACKUP_CHANNELS.setFrequency, frequency),
  chooseFolder: () => ipcRenderer.invoke(BACKUP_CHANNELS.chooseFolder),
};

/** Keys go in; nothing here can bring one back out. */
const secrets: MosaicSecrets = {
  status: () => ipcRenderer.invoke(SECRETS_CHANNELS.status),
  save: (provider, key, options) =>
    ipcRenderer.invoke(SECRETS_CHANNELS.save, provider, key, options),
  check: (provider) => ipcRenderer.invoke(SECRETS_CHANNELS.check, provider),
  listModels: (provider, refresh) =>
    ipcRenderer.invoke(SECRETS_CHANNELS.listModels, provider, refresh),
  remove: (provider) => ipcRenderer.invoke(SECRETS_CHANNELS.remove, provider),
  forgetAll: () => ipcRenderer.invoke(SECRETS_CHANNELS.forgetAll),
};

let toolRunnerRegistered = false;

/** Runs happen in main; the page follows them and runs the tools they call. */
const agent: MosaicAgent = {
  start: (request) => ipcRenderer.invoke(AGENT_CHANNELS.start, request),
  carryOn: (request) => ipcRenderer.invoke(AGENT_CHANNELS.carryOn, request),
  stop: (runId) => ipcRenderer.invoke(AGENT_CHANNELS.stop, runId),
  readMessages: (conversationId, page) =>
    ipcRenderer.invoke(AGENT_CHANNELS.readMessages, conversationId, page),
  readToolResult: (messageId, callId) =>
    ipcRenderer.invoke(AGENT_CHANNELS.readToolResult, messageId, callId),
  readOutdatedReads: (conversationId, templateId) =>
    ipcRenderer.invoke(AGENT_CHANNELS.readOutdatedReads, conversationId, templateId),
  readLastConversationId: () => ipcRenderer.invoke(AGENT_CHANNELS.readLastConversationId),
  onEvent: (follow) => {
    const listener = (_event: unknown, envelope: AgentRunEnvelope) => follow(envelope);
    ipcRenderer.on(AGENT_EVENT, listener);
    return () => ipcRenderer.removeListener(AGENT_EVENT, listener);
  },
  onToolCall: (run) => {
    if (toolRunnerRegistered) throw new Error('The page already runs the assistant’s tools');
    toolRunnerRegistered = true;
    const listener = (_event: unknown, call: AgentToolCall) => {
      void Promise.resolve()
        .then(() => run(call))
        .then(
          (result): AgentToolAnswer => ({ ok: true, result }),
          (error: unknown): AgentToolAnswer => ({ ok: false, message: String(error) })
        )
        .then((answer) => ipcRenderer.invoke(AGENT_TOOL_ANSWER, call.runId, call.callId, answer))
        .catch((error: unknown) => console.error('Could not answer a tool call:', error));
    };
    ipcRenderer.on(AGENT_TOOL_CALL, listener);
    return () => {
      ipcRenderer.removeListener(AGENT_TOOL_CALL, listener);
      toolRunnerRegistered = false;
    };
  },
};

const modelProviders: MosaicModelProviders = {
  usedModels: () => ipcRenderer.invoke(MODEL_PROVIDERS_CHANNELS.usedModels),
  ollamaModels: (address) => ipcRenderer.invoke(MODEL_PROVIDERS_CHANNELS.ollamaModels, address),
  openAiCompatibleModels: (address) =>
    ipcRenderer.invoke(MODEL_PROVIDERS_CHANNELS.openAiCompatibleModels, address),
};

/** Development builds only: main passes the argument to their page alone. */
const dev: MosaicDev | undefined = process.argv.includes(DEV_BUILD_ARGUMENT)
  ? {
      readRecent: () => ipcRenderer.invoke(DEV_CHANNELS.readRecent),
      saveRecent: (runs) => ipcRenderer.invoke(DEV_CHANNELS.saveRecent, runs),
      readSwitches: () => ipcRenderer.invoke(DEV_CHANNELS.readSwitches),
      saveSwitches: (switches) => ipcRenderer.invoke(DEV_CHANNELS.saveSwitches, switches),
      readReopenAddress: () => ipcRenderer.invoke(DEV_CHANNELS.readReopenAddress),
      saveReopenAddress: (address) => ipcRenderer.invoke(DEV_CHANNELS.saveReopenAddress, address),
      readMemory: () => ipcRenderer.invoke(DEV_CHANNELS.readMemory),
      seedLongConversation: (messageCount) =>
        ipcRenderer.invoke(DEV_CHANNELS.seedLongConversation, messageCount),
      readDataFolder: () => ipcRenderer.invoke(DEV_CHANNELS.readDataFolder),
      onOpenTools: (open) => {
        ipcRenderer.on(DEV_OPEN_TOOLS, () => open());
      },
    }
  : undefined;

contextBridge.exposeInMainWorld('mosaic', {
  platform: process.platform,
  db: dbBridge(),
  files,
  backup,
  secrets,
  modelProviders,
  agent,
  ...(dev && { dev }),
  app: {
    eraseAll: (): Promise<EraseResult> => ipcRenderer.invoke(ERASE_ALL),
    /** A Help menu item was chosen. */
    onHelpMenu: (answer: (command: HelpMenuCommand) => void) => {
      if (helpMenuRegistered) return;
      helpMenuRegistered = true;
      ipcRenderer.on(HELP_MENU_COMMAND, (_event, command: unknown) => {
        if (HELP_MENU_COMMANDS.includes(command as HelpMenuCommand)) {
          answer(command as HelpMenuCommand);
        }
      });
    },
    /** Main asks before the window closes; answer once pending saves have landed. */
    onFlushRequest: (flush: () => Promise<boolean>) => {
      if (flushRegistered) return;
      flushRegistered = true;
      ipcRenderer.on(FLUSH_REQUEST, () => {
        void flush()
          .catch(() => false)
          .then((isSaved) => ipcRenderer.send(FLUSH_DONE, isSaved));
      });
    },
  },
});
