import { SETTINGS_GROUPS } from '@/features/settings/settingsNav';
import type { TourKind } from '@/stores/overlayStore';
import type { ReadPaneView } from '@/types/history';
import type { SettingsSectionId } from '@/types/settings';
import { ADDRESS_SEPARATOR } from './formatViewAddress';
import {
  ADDRESS_DIALOGS,
  ADDRESS_READINGS,
  ADDRESS_TOURS,
  VIEW_KINDS,
  type AddressDialog,
  type ViewPlace,
} from './viewPlace';

/** What an address says, or which part of it can't be read, in words. */
export type ParsedAddress = { place: ViewPlace } | { error: string };

const VERSION_PART = /^(v\d+(?:\.\d+)?)(?:\s+vs\s+(v\d+(?:\.\d+)?|draft))?$/i;
const SUGGESTION_PART = /^suggestion\s+(\d+)$/i;
const STEP_PART = /^step\s+(\d+)$/i;

/** The key of `table` whose words are `words`, in any case. */
function findByWords<K extends string>(table: Record<K, string>, words: string): K | undefined {
  const wanted = words.trim().toLowerCase();
  return (Object.keys(table) as K[]).find((key) => table[key] === wanted);
}

function joinName(parts: string[]): string {
  return parts.join(ADDRESS_SEPARATOR).trim();
}

const describeTemplateNeeded = (kind: string) =>
  `A ${kind} address names its template, as in “${kind} / Base resume”.`;

function parseEditor(parts: string[]): ParsedAddress {
  const name = joinName(parts);
  const plus = name.lastIndexOf(' + ');
  if (plus < 0)
    return name
      ? { place: { kind: 'editor', template: name } }
      : { error: describeTemplateNeeded('editor') };
  const dialogWords = name.slice(plus + 3);
  const dialog = findByWords<AddressDialog>(ADDRESS_DIALOGS, dialogWords);
  if (!dialog) {
    const known = Object.values(ADDRESS_DIALOGS).join(', ');
    return { error: `No dialog called “${dialogWords}”. It can be ${known}.` };
  }
  return { place: { kind: 'editor', template: name.slice(0, plus).trim(), dialog } };
}

function parseHistory(parts: string[]): ParsedAddress {
  const rest = [...parts];
  const reading = findByWords<ReadPaneView>(ADDRESS_READINGS, rest.at(-1) ?? '');
  if (reading) rest.pop();
  const version = VERSION_PART.exec(rest.at(-1)?.trim() ?? '');
  if (version) rest.pop();
  const template = joinName(rest);
  if (!template) return { error: describeTemplateNeeded('history') };
  if (reading && !version) {
    return {
      error: `Name a version before “${ADDRESS_READINGS[reading]}”, as in “v12 / ${reading}”.`,
    };
  }
  return {
    place: {
      kind: 'history',
      template,
      version: version?.[1].toLowerCase(),
      base: version?.[2]?.toLowerCase(),
      reading,
    },
  };
}

function parseReview(parts: string[]): ParsedAddress {
  const rest = [...parts];
  const suggestion = SUGGESTION_PART.exec(rest.at(-1)?.trim() ?? '');
  if (suggestion) rest.pop();
  const template = joinName(rest);
  if (!template) return { error: describeTemplateNeeded('review') };
  return {
    place: { kind: 'review', template, suggestion: suggestion ? Number(suggestion[1]) : undefined },
  };
}

const SETTINGS_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.sections);

function parseSettings(parts: string[]): ParsedAddress {
  const words = joinName(parts).toLowerCase();
  const section = SETTINGS_SECTIONS.find(
    ({ id, label }) => id === words || label.toLowerCase() === words
  );
  if (!section) {
    const known = SETTINGS_SECTIONS.map(({ id }) => id).join(', ');
    return { error: `No Settings section called “${joinName(parts)}”. It can be ${known}.` };
  }
  return { place: { kind: 'settings', section: section.id satisfies SettingsSectionId } };
}

function parseTour(parts: string[]): ParsedAddress {
  const [tourWords = '', stepWords] = parts;
  const tour = findByWords<TourKind>(ADDRESS_TOURS, tourWords);
  if (!tour) {
    const known = Object.values(ADDRESS_TOURS).join(' or ');
    return { error: `No tour called “${tourWords}”. It can be ${known}.` };
  }
  const step = stepWords === undefined ? null : STEP_PART.exec(stepWords.trim());
  if (stepWords !== undefined && !step) return { error: `Can’t read “${stepWords}” as a step.` };
  return { place: { kind: 'tour', tour, step: step ? Number(step[1]) : 1 } };
}

const PARSERS: Record<ViewPlace['kind'], (parts: string[]) => ParsedAddress> = {
  start: (parts) =>
    parts.length
      ? { error: 'The start screen’s address is only “start”.' }
      : { place: { kind: 'start' } },
  editor: parseEditor,
  history: parseHistory,
  review: parseReview,
  settings: parseSettings,
  tour: parseTour,
};

/** Reads an address as `formatViewAddress` writes it, without checking that the view exists. */
export function parseViewAddress(text: string): ParsedAddress {
  const [head = '', ...rest] = text.trim().split(/\s+\/\s+/);
  const kind = VIEW_KINDS.find((known) => known === head.toLowerCase());
  if (!kind) {
    return {
      error: `An address starts with ${VIEW_KINDS.join(', ')}, not “${head}”.`,
    };
  }
  return PARSERS[kind](rest);
}

/** Whether typed text is meant as an address rather than a search. */
export function looksLikeViewAddress(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return VIEW_KINDS.some((kind) => trimmed.startsWith(`${kind} /`));
}
