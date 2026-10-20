import { discardProposals, stageProposals } from '@/features/agent/proposals/proposalActions';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { DevTool } from '../devTool';
import { createExampleResume, EXAMPLE_IDS, EXAMPLE_TEMPLATE_NAME } from './exampleResume';
import { createExampleSuggestions, EXAMPLE_REQUEST } from './exampleSuggestions';

const isExampleOpen = () =>
  getResumeSnapshot().sections.some((section) => section.id === EXAMPLE_IDS.experience);

async function openExampleResume(): Promise<string> {
  await useTemplateStore.getState().createTemplate(EXAMPLE_TEMPLATE_NAME, createExampleResume());
  useOverlayStore.getState().closeSurface('start');
  return `Opened “${EXAMPLE_TEMPLATE_NAME}”`;
}

/** Suggestions show only while the assistant is on, so staging them turns it on. */
async function stageExampleSuggestions(): Promise<string> {
  if (!isExampleOpen()) await openExampleResume();
  const { proposals, refusals } = stageProposals(EXAMPLE_REQUEST, createExampleSuggestions());
  const refused = refusals.length ? `, ${refusals.length} refused` : '';
  const agentSettings = useAgentSettingsStore.getState();
  const turnedOn = agentSettings.enabled ? '' : '. Turned the assistant on to show them';
  agentSettings.setEnabled(true);
  return `Staged ${proposals.length} example suggestions${refused}${turnedOn}`;
}

async function clearStagedSuggestions(): Promise<string> {
  discardProposals();
  return 'Cleared the staged suggestions';
}

/** Tools that bring in fictional data, or clear it. */
export const DATA_TOOLS: DevTool[] = [
  {
    id: 'exampleResume',
    group: 'Data',
    label: 'Open the example resume',
    description: 'A new template holding a fictional resume, Rowan Vale.',
    run: openExampleResume,
  },
  {
    id: 'stageSuggestions',
    group: 'Data',
    label: 'Stage one of each suggestion',
    description:
      'Every kind of suggestion and check, on the example resume. Turns the assistant on.',
    run: stageExampleSuggestions,
  },
  {
    id: 'clearSuggestions',
    group: 'Data',
    label: 'Clear staged suggestions',
    description: 'Drops what is waiting for review on the open template.',
    run: clearStagedSuggestions,
  },
];
