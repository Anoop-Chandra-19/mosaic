import { discardProposals, stageProposals } from '@/features/suggestions/proposals/proposalActions';
import { chooseBackup } from '@/features/backup/backupFiles';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { DevToolArgs } from '@shared/types/devTools';
import type { DevTool, DevToolStep } from './devTool';
import { loadProfile } from '../profiles/loadProfile';
import { makeHistory, type HistorySpec } from '../profiles/makeHistory';
import { PROFILE_NAMES, PROFILES, type ProfileName } from '../profiles/profiles';
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
