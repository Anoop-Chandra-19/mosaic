import { discardProposals, stageProposals } from '@/features/agent/proposals/proposalActions';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { DevToolArgs, DevToolRun } from '@shared/types/devTools';
import { createExampleResume, EXAMPLE_IDS, EXAMPLE_TEMPLATE_NAME } from './exampleResume';
import { createExampleSuggestions, EXAMPLE_REQUEST } from './exampleSuggestions';

/*
 * Tools for building and checking Mosaic, in development builds only: release builds leave
 * the module out (`--mode release`, see `AppShell.tsx`). The path: Ctrl+Shift+D, the wrench
 * or Develop › Developer tools… (`DevTools.tsx`) opens the palette (`DevToolsPalette.tsx`),
 * which lists `DEV_TOOLS` (`searchDevTools.ts`) and runs one with `runDevTool`, keeping it in
 * Recent (`recentDevRuns.ts`). e2e runs the same table through `devTestHook.ts`. The data
 * the tools bring in is fictional (`exampleResume.ts`, `exampleSuggestions.ts`).
 */

/** The palette's groups, in its order. */
export const DEV_TOOL_GROUPS = ['Data'] as const;
export type DevToolGroup = (typeof DEV_TOOL_GROUPS)[number];

export interface DevTool {
  id: string;
  group: DevToolGroup;
  label: string;
  description: string;
  /** Resolves with what to tell the user. */
  run: (args: DevToolArgs) => Promise<string>;
}

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

export const DEV_TOOLS: DevTool[] = [
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

export function findDevTool(toolId: string): DevTool | undefined {
  return DEV_TOOLS.find((tool) => tool.id === toolId);
}

/** Runs a tool with its choices, resolving with what to tell the user. */
export function runDevTool({ toolId, args }: DevToolRun): Promise<string> {
  const tool = findDevTool(toolId);
  if (!tool) return Promise.reject(new Error(`No developer tool “${toolId}”`));
  return tool.run(args);
}
