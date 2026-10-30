import type { AgentToolName } from '@shared/agent-tools/agentTools';
import { isAgentToolName } from '@shared/agent-tools/agentTools';
import type { ToolTarget } from '@shared/types/agentConversation';

/*
 * What a step is called on the run line, per tool: while it runs, once done, and when it was
 * refused. A running step has no target yet, so those words never say more than the tool
 * knows for sure. The note under a finished step comes from what the call was about.
 */

export interface StepWords {
  running: string;
  done: (target: ToolTarget | undefined) => string;
  refused: (target: ToolTarget | undefined) => string;
}

type Place = Extract<ToolTarget, { kind: 'place' }>;

const asPlace = (target: ToolTarget | undefined): Place | null =>
  target?.kind === 'place' ? target : null;

/** "a bullet", "a line": what a rewrite or a select names, from what it found. */
function nameUnit(target: ToolTarget | undefined, unknown: string): string {
  const place = asPlace(target);
  if (!place) return unknown;
  if (place.bullet !== undefined) return 'a bullet';
  if (place.line !== undefined) return 'a line';
  return place.entry ? 'an entry' : 'a section';
}

const quoted = (term: string) => `“${term}”`;

function nameList(target: ToolTarget | undefined): string {
  if (target?.kind !== 'list') return 'a list';
  if (target.of === 'section') return 'the sections';
  if (target.of === 'bullet') return 'bullets';
  return target.section ?? 'a list';
}

const SAME_WORDS = (running: string, done: string, refused: string): StepWords => ({
  running,
  done: () => done,
  refused: () => refused,
});

const STEP_WORDS: Record<AgentToolName, StepWords> = {
  read_document: SAME_WORDS('Reading your resume', 'Read your resume', 'Couldn’t read your resume'),
  read_newest_version: SAME_WORDS(
    'Reading your newest version',
    'Read your newest version',
    'Couldn’t read your newest version'
  ),
  propose_rewrite: {
    running: 'Rewriting',
    done: (target) => `Rewrote ${nameUnit(target, 'some text')}`,
    refused: (target) => `Couldn’t rewrite ${nameUnit(target, 'that')}`,
  },
  propose_rename: SAME_WORDS(
    'Renaming a section',
    'Renamed a section',
    'Couldn’t rename a section'
  ),
  propose_replace_everywhere: {
    running: 'Replacing a term',
    done: (target) =>
      target?.kind === 'term'
        ? `Replaced ${quoted(target.find)} with ${quoted(target.replace)}`
        : 'Replaced a term',
    refused: (target) =>
      target?.kind === 'term'
        ? `Couldn’t replace ${quoted(target.find)}`
        : 'Couldn’t replace a term',
  },
  propose_split: SAME_WORDS('Splitting a bullet', 'Split a bullet', 'Couldn’t split a bullet'),
  propose_merge: SAME_WORDS(
    'Joining two bullets',
    'Joined two bullets',
    'Couldn’t join two bullets'
  ),
  propose_reorder: {
    running: 'Reordering',
    done: (target) => `Reordered ${nameList(target)}`,
    refused: (target) => `Couldn’t reorder ${nameList(target)}`,
  },
  propose_select: {
    running: 'Changing what’s on the page',
    done: (target) =>
      asPlace(target)?.show === true
        ? `Put ${nameUnit(target, 'something')} back on the page`
        : `Left ${nameUnit(target, 'something')} off the page`,
    refused: (target) => `Couldn’t change ${nameUnit(target, 'that')}`,
  },
  propose_entry: SAME_WORDS('Adding an entry', 'Added an entry', 'Couldn’t add an entry'),
};

/** A tool the model made up still gets a row, so the run shows what it tried. */
const UNKNOWN_TOOL = (name: string): StepWords =>
  SAME_WORDS('Working', `Used ${name}`, `Tried ${name}, which Mosaic doesn’t have`);

export const readStepWords = (name: string): StepWords =>
  isAgentToolName(name) ? STEP_WORDS[name] : UNKNOWN_TOOL(name);

const ORDINAL_ENDINGS = ['th', 'st', 'nd', 'rd'];

/** "1st", "2nd", "11th". */
export function formatOrdinal(position: number): string {
  const teens = position % 100 >= 11 && position % 100 <= 13;
  return `${position}${(!teens && ORDINAL_ENDINGS[position % 10]) || 'th'}`;
}

/** Headings shown before the rest become a count, so the note stays one line. */
const MAX_SECTIONS_NAMED = 3;

function describeSections(sections: string[]): string {
  const named = sections.slice(0, MAX_SECTIONS_NAMED).join(', ');
  const rest = sections.length - MAX_SECTIONS_NAMED;
  return rest > 0 ? `${named} +${rest} more` : named;
}

function describePlace({ section, entry, bullet, lastBullet, line }: Place): string {
  if (line !== undefined) return `${section} · ${formatOrdinal(line)} line`;
  if (bullet === undefined) return entry ? `${section} · ${entry}` : section;
  const where = entry ?? section;
  return lastBullet === undefined
    ? `${where} · ${formatOrdinal(bullet)} bullet`
    : `${where} · ${formatOrdinal(bullet)} and ${formatOrdinal(lastBullet)} bullets`;
}

const NOTE_BY_KIND: {
  [K in ToolTarget['kind']]: (target: Extract<ToolTarget, { kind: K }>) => string | null;
} = {
  resume: ({ sections }) => describeSections(sections) || null,
  version: ({ version }) => version,
  place: describePlace,
  list: ({ of, entry }) => (of === 'bullet' ? (entry ?? null) : null),
  term: ({ count }) => (count > 0 ? `${count} ${count === 1 ? 'place' : 'places'}` : null),
};

/** The line under a step's name, from what the call was about; null when it found nothing. */
export function describeStepNote(target: ToolTarget | undefined): string | null {
  if (!target) return null;
  const describe = NOTE_BY_KIND[target.kind] as (target: ToolTarget) => string | null;
  return describe(target);
}
