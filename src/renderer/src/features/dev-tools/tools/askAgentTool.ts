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
    'This build can’t run the chosen provider yet. Choose Ollama, or turn on Scripted model.',
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

/** Suggestions show only while the assistant is on, so asking turns it on. */
async function askAgentFromPalette(args: DevToolArgs): Promise<string> {
  const agentSettings = useAgentSettingsStore.getState();
  const turnedOn = agentSettings.enabled ? '' : '. Turned the assistant on';
  // Main reads the setting at the start, and the write reaches it first.
  agentSettings.setEnabled(true);
  const start = await askAgent(String(args.text ?? ''));
  if (!start.ok) throw new Error(REFUSAL_WORDS[start.reason]);
  toastWhenRunEnds(start.runId);
  return `Asked the assistant, run ${start.runId}${turnedOn}`;
}

/** The assistant, before its pane: a run asked for by hand, its suggestions in the review. */
export const ASK_AGENT_TOOL: DevTool = {
  id: 'askAgent',
  group: 'Data',
  label: 'Ask the assistant…',
  description: 'Starts a run on the open resume; its suggestions come in for review.',
  prompt: 'What should the assistant do?',
  run: askAgentFromPalette,
};
