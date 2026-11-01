import { askAgent } from '@/features/agent/tools/agentRunTools';
import { agentService } from '@/lib/services/agentService';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { openConversation } from '@/stores/conversationStore';
import { showToast } from '@/stores/toastStore';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import type { DevToolArgs } from '@shared/types/devTools';
import { devService } from '../devService';
import type { DevTool } from './devTool';

const REFUSAL_WORDS: Record<AgentStartRefusal, string> = {
  assistantOff: 'The assistant is off.',
  runInProgress: 'A run is still going.',
  noApiKey: 'No API key is saved for the chosen provider. Add one in Settings.',
  keychainRefused: 'The keychain wouldn’t give back the API key.',
};

/** Says how the run ended, in a toast: there is no pane to show it yet. */
function toastWhenRunEnds(runId: number): void {
  const stopFollowing = agentService.onEvent((envelope) => {
    if (envelope.runId !== runId || envelope.event.type !== 'runEnded') return;
    stopFollowing();
    const { stopReason } = envelope.event;
    if (stopReason) showToast(`Run ${runId} stopped: ${stopReason}`, 'error', undefined, 'DEV');
    else showToast(`Run ${runId} finished`, 'success', undefined, 'DEV');
  });
}

/** The conversation the palette last asked in, until the window reloads. */
let lastConversationId: number | null = null;

/** Suggestions show only while the assistant is on, so asking turns it on. */
async function askAgentFromPalette(text: string, conversationId: number | null): Promise<string> {
  const agentSettings = useAgentSettingsStore.getState();
  const turnedOn = agentSettings.enabled ? '' : '. Turned the assistant on';
  // Main reads the setting at the start, and the write reaches it first.
  agentSettings.setEnabled(true);
  const start = await askAgent(text, conversationId);
  if (!start.ok) throw new Error(REFUSAL_WORDS[start.reason]);
  lastConversationId = start.conversationId;
  toastWhenRunEnds(start.runId);
  return `Asked the assistant, run ${start.runId} in conversation ${start.conversationId}${turnedOn}`;
}

const askedText = (args: DevToolArgs) => String(args.text ?? '');

const LONG_CONVERSATION_MESSAGES = 2000;
const MANY_CONVERSATIONS = 120;

/** The assistant, before its pane: a run asked for by hand, its suggestions in the review. */
export const ASK_AGENT_TOOLS: DevTool[] = [
  {
    id: 'askAgent',
    group: 'Data',
    label: 'Ask the assistant…',
    description:
      'Carries on the conversation last asked in from here, or starts one. Suggestions come in for review.',
    prompt: 'What should the assistant do?',
    run: (args) => askAgentFromPalette(askedText(args), lastConversationId),
  },
  {
    id: 'askAgentNew',
    group: 'Data',
    label: 'Ask in a new conversation…',
    description: 'Starts a conversation on the open resume, with nothing from earlier runs.',
    prompt: 'What should the assistant do?',
    run: (args) => askAgentFromPalette(askedText(args), null),
  },
  {
    id: 'longConversation',
    group: 'Data',
    label: 'Open a long conversation',
    description: 'Writes 2,000 fictional messages as a new conversation and opens it in the pane.',
    run: async (args) => {
      const messageCount = Number(args.messages ?? LONG_CONVERSATION_MESSAGES);
      useAgentSettingsStore.getState().setEnabled(true);
      const conversationId = await devService.seedLongConversation(messageCount);
      await openConversation(conversationId);
      return `Opened conversation ${conversationId}, about ${messageCount} messages`;
    },
  },
  {
    id: 'manyConversations',
    group: 'Data',
    label: 'Write many conversations',
    description: 'Writes 120 short fictional conversations, for the list in the pane.',
    run: async (args) => {
      const count = Number(args.count ?? MANY_CONVERSATIONS);
      useAgentSettingsStore.getState().setEnabled(true);
      for (let written = 0; written < count; written++) await devService.seedLongConversation(4);
      return `Wrote ${count} conversations`;
    },
  },
];
