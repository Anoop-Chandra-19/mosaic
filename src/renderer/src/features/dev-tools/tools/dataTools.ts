import {
  acceptProposals,
  discardProposals,
  stageProposals,
} from '@/features/suggestions/proposals/proposalActions';
import { chooseBackup } from '@/features/backup/backupFiles';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { DevToolArgs } from '@shared/types/devTools';
import type { DevTool, DevToolStep } from './devTool';
import { loadProfile } from '../profiles/loadProfile';
import { makeHistory, type HistorySpec } from '../profiles/makeHistory';
import { PROFILE_NAMES, PROFILES, type ProfileName } from '../profiles/profiles';
import { createExampleResume, EXAMPLE_IDS, EXAMPLE_TEMPLATE_NAME } from './exampleResume';
import {
  createExampleBulletWithNumber,
  createExampleSecondVersion,
  createExampleSuggestions,
  EXAMPLE_REQUEST,
} from './exampleSuggestions';

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
  // A second call, as the assistant makes one: it fills a bullet into a suggested entry.
  const later = stageProposals(EXAMPLE_REQUEST, createExampleBulletWithNumber(proposals));
  const refusedCount = refusals.length + later.refusals.length;
  const refused = refusedCount ? `, ${refusedCount} refused` : '';
  return `Staged ${proposals.length} example suggestions${refused}${turnAssistantOn()}`;
}

/** Turn the assistant on, so staged suggestions show. Returns what to add to the tool's answer. */
function turnAssistantOn(): string {
  const agentSettings = useAgentSettingsStore.getState();
  const turnedOn = agentSettings.enabled ? '' : '. Turned the assistant on to show them';
  agentSettings.setEnabled(true);
  return turnedOn;
}

/**
 * Stage the example suggestions, keep the first, then rewrite the text it wrote in a later
 * call, as the assistant does, so that card has a kept version 1 and a waiting version 2.
 */
async function stageExampleVersions(): Promise<string> {
  await stageExampleSuggestions();
  const [first] = useProposalStore.getState().byTemplate[openTemplateIdOrThrow()] ?? [];
  if (first) acceptProposals([first.id]);
  const { reworded, refusals } = stageProposals(EXAMPLE_REQUEST, createExampleSecondVersion());
  if (refusals.length || !reworded[0]?.isNewVersion) {
    throw new Error('Expected the example rewrite to make version 2 of the kept suggestion');
  }
  return 'Staged the example suggestions, kept the first, and made its version 2';
}

function openTemplateIdOrThrow(): string {
  const { templateId } = useResumeStore.getState();
  if (templateId === null) throw new Error('Expected a template to be open after staging');
  return templateId;
}

async function clearStagedSuggestions(): Promise<string> {
  discardProposals();
  return 'Cleared the staged suggestions';
}

function readProfileName(args: DevToolArgs): ProfileName {
  const name = PROFILE_NAMES.find((profile) => profile === args.profile);
  if (!name) throw new Error(`No profile “${String(args.profile)}”`);
  return name;
}

const PROFILE_STEP: DevToolStep = {
  key: 'profile',
  placeholder: 'Which profile',
  listOptions: async () =>
    PROFILE_NAMES.map((name) => ({ value: name, label: name, hint: PROFILES[name].holds })),
};

/** As Settings does it: the picker, then Restore a backup on the file chosen. */
async function restoreBackupFile(): Promise<string> {
  const backup = await chooseBackup();
  if (backup) useOverlayStore.getState().openDialog({ kind: 'restoreBackup', backup });
  return '';
}

const everyNth = (count: number, nth: number): HistorySpec['versions'] =>
  Array.from({ length: count }, (_, index) =>
    (index + 2) % nth === 0 ? { name: `Round ${index + 2}` } : {}
  );

const HISTORY_PRESETS: Record<string, { label: string; spec: HistorySpec }> = {
  threeNamed: {
    label: 'Three named versions',
    spec: {
      versions: [
        { name: 'First', contactName: 'Rowan Vale' },
        { name: 'Second', contactName: 'Rowan Hale' },
        { name: 'Third', contactName: 'Rowan Gale' },
      ],
    },
  },
  everyFourth: {
    label: 'Twelve versions, every fourth named',
    spec: { versions: everyNth(11, 4) },
  },
  everyTenth: { label: 'Sixty versions, every tenth named', spec: { versions: everyNth(59, 10) } },
};

const HISTORY_STEP: DevToolStep = {
  key: 'preset',
  placeholder: 'Which history',
  listOptions: async () =>
    Object.entries(HISTORY_PRESETS).map(([value, preset]) => ({
      value,
      label: preset.label,
      hint: `${preset.spec.versions.length + 1} versions`,
    })),
  describe: (value) => HISTORY_PRESETS[String(value)]?.label ?? String(value),
};

function readHistoryPreset(args: DevToolArgs): HistorySpec {
  const preset = HISTORY_PRESETS[String(args.preset)];
  if (!preset) throw new Error(`No history “${String(args.preset)}”`);
  return preset.spec;
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
    id: 'stageSuggestionVersions',
    group: 'Data',
    label: 'Stage a kept suggestion with a second version',
    description:
      'The example suggestions, with the first kept and then rewritten, so its card has two versions.',
    run: stageExampleVersions,
  },
  {
    id: 'clearSuggestions',
    group: 'Data',
    label: 'Clear staged suggestions',
    description: 'Drops what is waiting for review on the open template.',
    run: clearStagedSuggestions,
  },
  {
    id: 'loadProfile',
    group: 'Data',
    label: 'Replace all data with a profile',
    description: 'Fresh, Everyday or Heavy, generated. Asks first.',
    steps: [PROFILE_STEP],
    replacesData: (args) => ({
      replacement: readProfileName(args),
      leaves: PROFILES[readProfileName(args)].leaves,
    }),
    run: (args) => loadProfile(readProfileName(args)),
  },
  {
    id: 'restoreBackupFile',
    group: 'Data',
    label: 'Restore a backup file',
    description: 'Picks a backup, then opens Restore a backup on it, as Settings does.',
    run: restoreBackupFile,
  },
  {
    id: 'makeHistory',
    group: 'Data',
    label: 'Make a history',
    description: 'A new template with its versions made for it: named ones, and edits between.',
    steps: [HISTORY_STEP],
    run: (args) => makeHistory(readHistoryPreset(args)),
  },
];
