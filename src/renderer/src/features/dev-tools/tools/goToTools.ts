import {
  labelSuggestionKind,
  placeSuggestion,
} from '@/features/suggestions/proposals/describeSuggestion';
import { versionLabel } from '@/features/history/versionLabel';
import { GETTING_STARTED_STEPS } from '@/features/onboarding/getting-started/gettingStartedSteps';
import { HISTORY_TOUR_STEPS } from '@/features/onboarding/history/historyTourSteps';
import { SETTINGS_GROUPS } from '@/features/settings/settingsNav';
import { formatViewAddress } from '@/features/view-address/formatViewAddress';
import { listComparisons } from '@/features/view-address/resolveViewPlace';
import { copyViewAddress, goToView, goToViewAddress } from '@/features/view-address/viewAddress';
import type { AddressDialog, ViewPlace } from '@/features/view-address/viewPlace';
import type { TourKind } from '@/stores/overlayStore';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { readVersionHistory, useTemplateStore } from '@/stores/templateStore';
import type { HistoryComparison, ReadPaneView } from '@/types/history';
import type { SettingsSectionId } from '@/types/settings';
import type { DevToolArgs } from '@shared/types/devTools';
import type { DevTool, DevToolStep } from '../devTool';

/*
 * Tools that go to a view, one per kind of view, each taking its choices as steps. What they
 * choose is the view's address in plain values, so a run kept in Recent goes back to the same
 * view; `goToView` checks it against what exists first.
 */

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const listTemplates = () => useTemplateStore.getState().templates;
const openTemplateName = () =>
  listTemplates().find((template) => template.id === useResumeStore.getState().templateId)?.name;
const findTemplateId = (name: DevToolArgs[string] | undefined) =>
  listTemplates().find((template) => template.name === name)?.id;

async function readVersionsOf(args: DevToolArgs) {
  const templateId = findTemplateId(args.template);
  return templateId ? readVersionHistory(templateId) : [];
}

const TEMPLATE_STEP: DevToolStep = {
  key: 'template',
  placeholder: 'Which template',
  listOptions: async () =>
    listTemplates().map((template) => ({
      value: template.name,
      label: template.name,
      hint: `${template.versionCount} versions`,
      isDefault: template.name === openTemplateName(),
    })),
};

const VERSION_STEP: DevToolStep = {
  key: 'version',
  placeholder: 'Version: type its number or name',
  listOptions: async (args) =>
    (await readVersionsOf(args)).map((version, index) => ({
      value: versionLabel(version),
      label: versionLabel(version),
      detail: version.summary,
      isNamed: version.kind === 'named',
      hint: index === 0 ? 'newest' : DAY_FORMAT.format(version.createdAt),
      isDefault: index === 0,
    })),
};

const COMPARISON_LABELS: Record<HistoryComparison, string> = {
  parent: 'The one before it',
  number: 'Before its number',
  draft: 'Your draft',
};

const COMPARE_STEP: DevToolStep = {
  key: 'compare',
  placeholder: 'Compare with',
  listOptions: async (args) => {
    const versions = await readVersionsOf(args);
    const index = versions.findIndex((version) => versionLabel(version) === args.version);
    return listComparisons(versions, index).map(({ base, comparison }) => ({
      value: base,
      label: COMPARISON_LABELS[comparison],
      hint: comparison === 'draft' ? undefined : base,
      isDefault: comparison === 'parent',
    }));
  },
  describe: (base) => `vs ${base}`,
};

const READING_LABELS: Record<ReadPaneView, string> = { page: 'Page', changes: 'Changes only' };

const READING_STEP: DevToolStep = {
  key: 'reading',
  placeholder: 'View as',
  listOptions: async () =>
    (Object.keys(READING_LABELS) as ReadPaneView[]).map((reading) => ({
      value: reading,
      label: READING_LABELS[reading],
      isDefault: reading === 'page',
    })),
  describe: (reading) => READING_LABELS[reading as ReadPaneView],
};

const SUGGESTION_STEP: DevToolStep = {
  key: 'suggestion',
  placeholder: 'Which suggestion',
  listOptions: async (args) => {
    const templateId = findTemplateId(args.template) ?? null;
    const proposals = selectTemplateProposals(useProposalStore.getState(), templateId).filter(
      (proposal) => proposal.status !== 'applied'
    );
    const doc = getResumeSnapshot();
    return [
      { value: 0, label: 'None, the whole review', isDefault: true },
      ...proposals.map(({ change }, index) => ({
        value: index + 1,
        label: labelSuggestionKind(change),
        detail: placeSuggestion(doc, change).join(', '),
        hint: `#${index + 1}`,
      })),
    ];
  },
  describe: (suggestion) => (suggestion ? `#${suggestion}` : 'whole review'),
};

const SETTINGS_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.sections);

const SECTION_STEP: DevToolStep = {
  key: 'section',
  placeholder: 'Which section',
  listOptions: async () =>
    SETTINGS_SECTIONS.map(({ id, label }) => ({ value: id, label, isDefault: id === 'general' })),
  describe: (id) => SETTINGS_SECTIONS.find((section) => section.id === id)?.label ?? String(id),
};

const DIALOG_LABELS: Record<AddressDialog, string> = {
  import: 'Import',
  export: 'Export',
  nameVersion: 'Name version',
  shortcuts: 'Keyboard shortcuts',
};

const DIALOG_STEP: DevToolStep = {
  key: 'dialog',
  placeholder: 'Which dialog',
  listOptions: async () =>
    (Object.keys(DIALOG_LABELS) as AddressDialog[]).map((dialog) => ({
      value: dialog,
      label: DIALOG_LABELS[dialog],
    })),
  describe: (dialog) => DIALOG_LABELS[dialog as AddressDialog],
};

const TOUR_STEP_TITLES: Record<TourKind, string[]> = {
  gettingStarted: GETTING_STARTED_STEPS.map((step) => step.title),
  history: HISTORY_TOUR_STEPS.map((step) => step.title({ isRestoreKept: true })),
};
const TOUR_LABELS: Record<TourKind, string> = {
  gettingStarted: 'Getting started',
  history: 'History',
};

const TOUR_STEP: DevToolStep = {
  key: 'tour',
  placeholder: 'Which tour',
  listOptions: async () =>
    (Object.keys(TOUR_LABELS) as TourKind[]).map((tour) => ({
      value: tour,
      label: TOUR_LABELS[tour],
      hint: `${TOUR_STEP_TITLES[tour].length} steps`,
    })),
  describe: (tour) => TOUR_LABELS[tour as TourKind],
};

const TOUR_STOP_STEP: DevToolStep = {
  key: 'step',
  placeholder: 'Which step',
  listOptions: async (args) =>
    TOUR_STEP_TITLES[args.tour as TourKind].map((title, index) => ({
      value: index + 1,
      label: title,
      hint: `step ${index + 1}`,
      isDefault: index === 0,
    })),
  describe: (step) => `step ${step}`,
};

/** The view a run goes to. A choice not made yet reads "…", for the address being built. */
type PlaceOf = (args: DevToolArgs) => ViewPlace;

const text = (value: DevToolArgs[string] | undefined) =>
  value === undefined ? '…' : String(value);

interface GoToTool extends Omit<DevTool, 'run' | 'group'> {
  placeOf: PlaceOf;
}

const GO_TO_VIEWS: GoToTool[] = [
  {
    id: 'editor',
    label: 'Editor',
    description: 'A template’s editor.',
    steps: [TEMPLATE_STEP],
    placeOf: (args) => ({ kind: 'editor', template: text(args.template) }),
  },
  {
    id: 'history',
    label: 'Full history',
    description: 'On a version, compared with another, as Page or Changes only.',
    steps: [TEMPLATE_STEP, VERSION_STEP, COMPARE_STEP, READING_STEP],
    placeOf: (args) => ({
      kind: 'history',
      template: text(args.template),
      version: text(args.version),
      base: text(args.compare),
      reading: args.reading as ReadPaneView | undefined,
    }),
  },
  {
    id: 'review',
    label: 'Review',
    description: 'The review page, optionally on one suggestion.',
    steps: [TEMPLATE_STEP, SUGGESTION_STEP],
    placeOf: (args) => ({
      kind: 'review',
      template: text(args.template),
      suggestion: Number(args.suggestion) || undefined,
    }),
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'A section, such as History or Data.',
    steps: [SECTION_STEP],
    placeOf: (args) => ({ kind: 'settings', section: text(args.section) as SettingsSectionId }),
  },
  {
    id: 'dialog',
    label: 'A dialog',
    description: 'Import, Export, Name version or Keyboard shortcuts, over the editor.',
    steps: [DIALOG_STEP],
    placeOf: (args) => ({
      kind: 'editor',
      template: openTemplateName() ?? '…',
      dialog: args.dialog as AddressDialog | undefined,
    }),
  },
  {
    id: 'tour',
    label: 'A tour',
    description: 'On a given step.',
    steps: [TOUR_STEP, TOUR_STOP_STEP],
    placeOf: (args) => ({
      kind: 'tour',
      tour: (args.tour as TourKind | undefined) ?? 'gettingStarted',
      step: Number(args.step) || 1,
    }),
  },
  {
    id: 'start',
    label: 'Start screen',
    description: 'As after closing the last template.',
    placeOf: () => ({ kind: 'start' }),
  },
];

/** Goes there, or fails with why the view doesn't exist. */
async function goTo(place: ViewPlace): Promise<string> {
  const resolution = await goToView(place);
  if ('error' in resolution) throw new Error(resolution.error);
  if ('sameName' in resolution) {
    const name = resolution.sameName[0].name;
    throw new Error(
      `${resolution.sameName.length} templates are named “${name}”. Paste the address to choose one.`
    );
  }
  return '';
}

export const GO_TO_TOOLS: DevTool[] = GO_TO_VIEWS.map(({ placeOf, ...tool }) => ({
  ...tool,
  group: 'Go to',
  run: (args) => goTo(placeOf(args)),
}));

/** The address a Go to run is building, with "…" for what isn't chosen yet. */
export function describeGoToAddress(toolId: string, args: DevToolArgs): string | null {
  const view = GO_TO_VIEWS.find((tool) => tool.id === toolId);
  return view ? formatViewAddress(view.placeOf(args)) : null;
}

export const ADDRESS_TOOLS: DevTool[] = [
  {
    id: 'copyAddress',
    group: 'Address',
    label: 'Copy this view’s address',
    description: 'For a bug report, or to come back here.',
    keys: 'Mod+Shift+C',
    run: async () => `Copied the address: ${await copyViewAddress()}`,
  },
  {
    id: 'goToAddress',
    group: 'Address',
    label: 'Go to an address',
    description: 'Paste one into the search field to go there.',
    prompt: 'Paste an address, such as history / Base resume / v12',
    run: async (args) => {
      const chosenId = typeof args.templateId === 'string' ? args.templateId : undefined;
      const resolution = await goToViewAddress(String(args.text ?? ''), chosenId);
      if ('error' in resolution) throw new Error(resolution.error);
      if ('sameName' in resolution) throw new Error('Several templates share that name.');
      return '';
    },
  },
];
