import { findComparedBase } from '@/features/history/full-history/prepareHistoryOpening';
import { versionLabel } from '@/features/history/versionLabel';
import { GETTING_STARTED_STEPS } from '@/features/onboarding/getting-started/gettingStartedSteps';
import { HISTORY_TOUR_STEPS } from '@/features/onboarding/history/historyTourSteps';
import type { AppPlace } from '@/features/navigation/appPlace';
import type { DialogRequest, TourKind } from '@/stores/overlayStore';
import type { HistoryComparison } from '@/types/history';
import type { TemplateSummary, VersionMeta } from '@shared/types/db';
import { ADDRESS_TOURS, type AddressDialog, type ViewPlace } from './viewPlace';

/** The dialog each address word opens over the editor. */
const DIALOG_REQUESTS: Record<AddressDialog, DialogRequest> = {
  import: { kind: 'import', asNewOnly: false },
  export: { kind: 'export', version: null },
  nameVersion: { kind: 'nameVersion' },
  shortcuts: { kind: 'shortcuts', place: null },
};

/**
 * The view, or why it doesn't exist, in words. Template names needn't be unique: two with
 * the name are handed back to choose from.
 */
export type Resolution =
  | { resolved: AppPlace }
  | { error: string }
  | { sameName: TemplateSummary[] };

/** What an address is checked against. */
export interface ViewLookup {
  templates: readonly TemplateSummary[];
  /** A template's history, newest first. */
  readVersions: (templateId: string) => Promise<VersionMeta[]>;
  /** The suggestions the review lists for a template, in its order. */
  listSuggestionIds: (templateId: string) => readonly string[];
}

const TOUR_STEP_COUNTS: Record<TourKind, number> = {
  gettingStarted: GETTING_STARTED_STEPS.length,
  history: HISTORY_TOUR_STEPS.length,
};

/** The comparisons a version has, by what each is compared with. */
export function listComparisons(
  versions: VersionMeta[],
  index: number
): { base: string; comparison: HistoryComparison }[] {
  const comparisons: { base: string; comparison: HistoryComparison }[] = [];
  for (const comparison of ['parent', 'number'] as const) {
    const base = findComparedBase(versions, index, comparison);
    if (base && !comparisons.some((known) => known.base === versionLabel(base))) {
      comparisons.push({ base: versionLabel(base), comparison });
    }
  }
  comparisons.push({ base: 'draft', comparison: 'draft' });
  return comparisons;
}

async function resolveHistory(
  place: Extract<ViewPlace, { kind: 'history' }>,
  template: TemplateSummary,
  lookup: ViewLookup
): Promise<Resolution> {
  const at = { kind: 'history', templateId: template.id, reading: place.reading } as const;
  if (!place.version) return { resolved: at };
  const versions = await lookup.readVersions(template.id);
  const index = versions.findIndex((version) => versionLabel(version) === place.version);
  if (index < 0) {
    const newest = versions[0] ? `, the newest ${versionLabel(versions[0])}` : '';
    return { error: `“${template.name}” has no ${place.version}${newest}.` };
  }
  const versionId = versions[index].id;
  if (!place.base) return { resolved: { ...at, versionId } };
  const comparisons = listComparisons(versions, index);
  const match = comparisons.find(({ base }) => base === place.base);
  if (!match) {
    const known = comparisons.map(({ base }) => base).join(' or ');
    return { error: `${place.version} is compared with ${known}, not ${place.base}.` };
  }
  return { resolved: { ...at, versionId, comparison: match.comparison } };
}

function resolveReview(
  place: Extract<ViewPlace, { kind: 'review' }>,
  template: TemplateSummary,
  lookup: ViewLookup
): Resolution {
  const at = { kind: 'review', templateId: template.id } as const;
  if (!place.suggestion) return { resolved: at };
  const ids = lookup.listSuggestionIds(template.id);
  const proposalId = ids[place.suggestion - 1];
  if (!proposalId) {
    return {
      error: `“${template.name}” has ${ids.length} suggestions waiting, so no suggestion ${place.suggestion}.`,
    };
  }
  return { resolved: { ...at, proposalId } };
}

function findTemplate(
  name: string,
  lookup: ViewLookup,
  chosenId: string | undefined
): TemplateSummary | Resolution {
  if (chosenId) {
    const chosen = lookup.templates.find((template) => template.id === chosenId);
    if (chosen) return chosen;
  }
  const named = lookup.templates.filter(
    (template) => template.name.toLowerCase() === name.toLowerCase()
  );
  if (named.length === 1) return named[0];
  return named.length ? { sameName: named } : { error: `No template named “${name}”.` };
}

/**
 * Checks a view against what exists. `chosenTemplateId` picks one of several templates that
 * share the address's name.
 */
export async function resolveViewPlace(
  place: ViewPlace,
  lookup: ViewLookup,
  chosenTemplateId?: string
): Promise<Resolution> {
  switch (place.kind) {
    case 'start':
    case 'settings':
      return { resolved: place };
    case 'tour': {
      const count = TOUR_STEP_COUNTS[place.tour];
      if (place.step < 1 || place.step > count) {
        return { error: `The ${ADDRESS_TOURS[place.tour]} tour has ${count} steps.` };
      }
      return { resolved: place };
    }
  }
  const template = findTemplate(place.template, lookup, chosenTemplateId);
  if (!('id' in template)) return template;
  switch (place.kind) {
    case 'editor':
      return {
        resolved: {
          kind: 'editor',
          templateId: template.id,
          dialog: place.dialog && DIALOG_REQUESTS[place.dialog],
        },
      };
    case 'history':
      return resolveHistory(place, template, lookup);
    case 'review':
      return resolveReview(place, template, lookup);
  }
}
