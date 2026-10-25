import { askAgent } from '@/features/agent/agentRunTools';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { showToast } from '@/stores/toastStore';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import type { DevToolArgs } from '@shared/types/devTools';
import type { DevTool } from './devTool';

const REFUSAL_WORDS: Record<AgentStartRefusal, string> = {
  assistantOff: 'The assistant is off.',
  runInProgress: 'A run is still going.',
  providerNotSupported:
    'This build can’t run the chosen provider yet. Choose Ollama or OpenAI, or turn on Scripted model.',
  noApiKey: 'No API key is saved for the chosen provider. Add one in Settings.',
  keychainRefused: 'The keychain wouldn’t give back the API key.',
};

/** Says how the run ended, in a toast: there is no pane to show it yet. */
function toastWhenRunEnds(runId: number): void {
  const stopFollowing = window.mosaic.agent.onEvent((envelope) => {
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
];
