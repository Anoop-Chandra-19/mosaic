import { stageProposals } from '@/features/agent/proposals/proposalActions';
import { useAiStore } from '@/stores/aiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { createExampleResume, EXAMPLE_IDS, EXAMPLE_TEMPLATE_NAME } from './exampleResume';
import { createExampleSuggestions, EXAMPLE_REQUEST } from './exampleSuggestions';

/*
 * Tools for building and checking Mosaic, in development builds only: release builds
 * leave the module out (`--mode release`, see `TopBar.tsx`). Each tool is an entry in
 * `DEV_TOOLS`, which `DevToolsMenu.tsx` lists and e2e specs run through the same menu.
 * The data they bring in is fictional (`exampleResume.ts`, `exampleSuggestions.ts`).
 */

export interface DevTool {
  label: string;
  description: string;
  /** Resolves with what to tell the user. */
  run: () => Promise<string>;
}

const isExampleOpen = () =>
  getResumeSnapshot().sections.some((section) => section.id === EXAMPLE_IDS.experience);

async function loadExampleResume(): Promise<string> {
  await useTemplateStore.getState().createTemplate(EXAMPLE_TEMPLATE_NAME, createExampleResume());
  useOverlayStore.getState().closeSurface('start');
  return `Opened “${EXAMPLE_TEMPLATE_NAME}”`;
}

/** Suggestions show only while the assistant is on, so staging them turns it on. */
async function stageExampleSuggestions(): Promise<string> {
  if (!isExampleOpen()) await loadExampleResume();
  const { proposals, refusals } = stageProposals(EXAMPLE_REQUEST, createExampleSuggestions());
  const refused = refusals.length ? `, ${refusals.length} refused` : '';
  const ai = useAiStore.getState();
  const turnedOn = ai.enabled ? '' : '. Turned the assistant on to show them';
  ai.setEnabled(true);
  return `Staged ${proposals.length} example suggestions${refused}${turnedOn}`;
}

export const DEV_TOOLS: DevTool[] = [
  {
    label: 'Load the example resume',
    description: 'Opens a new template holding a fictional resume, Rowan Vale.',
    run: loadExampleResume,
  },
  {
    label: 'Stage example suggestions',
    description:
      'Stages every kind of suggestion and check on the example resume, opening it first if needed, and turns the assistant on.',
    run: stageExampleSuggestions,
  },
];
