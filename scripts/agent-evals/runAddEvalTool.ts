/**
 * One tool call of the add eval, run against its resume as if the user kept the suggestion
 * at once, so the next call and the scoring see it: the resume is the model's draft, its
 * suggestions applied. A refusal states facts, written per kind of problem: what a handle
 * is, which list it is in, what the tool takes and which tool does the other thing; never a
 * guess at what the user asked. Only a call that can't be turned into one change is
 * refused: one that changes nothing (`diffWords` finds no word changed) answers so, and a
 * new bullet into a section with one entry goes into that entry. Split and merge are
 * answered but not simulated: no case asks for them, so the scorer counts them as wrong.
 */
import { replaceEveryWholeWord } from '../../src/renderer/src/features/agent/tools/replaceEveryWholeWord.ts';
import { diffWords } from '../../src/renderer/src/features/suggestions/proposals/diffWords.ts';
import { SECTION_PRESETS } from '../../src/shared/resume/sectionPresets.ts';
import type { BuiltInSectionKind, SectionKind } from '../../src/shared/types/resume.ts';
import {
  nextEvalHandle,
  type EvalEntry,
  type EvalResume,
  type EvalSection,
  type EvalText,
} from './addEvalResume.ts';
import { SECTION_KINDS, type AddEvalToolSet } from './addEvalTools.ts';
import type { ResumeLookup } from './readEvalToolArgs.ts';

/**
 * How a tool that makes or moves something answers: `short` names the handle, as B1's
 * answers do; `echo` also says what and where ("a new line in s3: "…"", as the spike did);
 * `list` shows the list it is now in, with it marked. Rewrites always answer short.
 */
export type AnswerStyle = 'short' | 'echo' | 'list';

export interface AddEvalSettings extends AddEvalToolSet {
  answers: AnswerStyle;
}

export interface AddEvalToolAnswer {
  answer: string;
  isRefused: boolean;
  /** Answered without changing the resume, so the case can't be scored as right. */
  isUnscored?: boolean;
}

type Args = Record<string, unknown>;

type RunTool = (resume: EvalResume, args: Args, toolSet: AddEvalSettings) => AddEvalToolAnswer;

type Handled = { handle: string };

const suggested = (handle: string): AddEvalToolAnswer => ({
  answer: `Suggested for ${handle}.\nChecks: none.`,
  isRefused: false,
});

const refuse = (problem: string): AddEvalToolAnswer => ({ answer: problem, isRefused: true });

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A list of strings, also when a model sends the list as a JSON string. */
function readStrings(value: unknown): string[] {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? list.map(readString).filter(Boolean) : [];
}

const hasSameWords = (before: string, after: string) =>
  diffWords(before, after).every((part) => part.kind === 'same' || !part.text.trim());

const markSuggested = (resume: EvalResume, key: string) => (resume.suggested ??= []).push(key);

const wasSuggested = (resume: EvalResume, key: string) => resume.suggested?.includes(key) ?? false;

/**
 * A call that changes nothing, which has one reading, so it isn't refused: already
 * suggested, when the run's own suggestion made it so (a repeat, which staging would
 * replace with itself), or nothing changed, when it is the user's own.
 */
function answerNoChange(resume: EvalResume, key: string, what: string, fact: string) {
  const answer = wasSuggested(resume, key)
    ? `Already suggested: ${what}.`
    : `Nothing changed. ${fact}`;
  return { answer: `${answer}\nChecks: none.`, isRefused: false };
}

/** The key a list's order is suggested under: "order:sections", or "order:" and its holder. */
const orderKey = (place: HandlePlace) => `order:${place.holder ?? 'sections'}`;

const findSection = (resume: EvalResume, handle: string) =>
  resume.sections.find((section) => section.handle === handle);

const listEntries = (resume: EvalResume) => resume.sections.flatMap((section) => section.entries);

const findEntry = (resume: EvalResume, handle: string) =>
  listEntries(resume).find((entry) => entry.handle === handle);

type HandleKind = 'section' | 'entry' | 'bullet' | 'line';

/** Where a handle is: its list, what it is, and what holds the list (null: the resume). */
interface HandlePlace {
  list: Handled[];
  kind: HandleKind;
  holder: string | null;
}

function findHandlePlace(resume: EvalResume, handle: string): HandlePlace | undefined {
  const isHere = (list: Handled[]) => list.some((item) => item.handle === handle);
  if (isHere(resume.sections)) return { list: resume.sections, kind: 'section', holder: null };
  for (const section of resume.sections) {
    if (isHere(section.lines)) return { list: section.lines, kind: 'line', holder: section.handle };
    if (isHere(section.entries)) {
      return { list: section.entries, kind: 'entry', holder: section.handle };
    }
    for (const entry of section.entries) {
      if (isHere(entry.bullets))
        return { list: entry.bullets, kind: 'bullet', holder: entry.handle };
    }
  }
  return undefined;
}

const ONE_OF_KIND: Record<HandleKind, string> = {
  section: 'a section',
  entry: 'an entry',
  bullet: 'a bullet',
  line: 'a line',
};

const KIND_PLURAL: Record<HandleKind, string> = {
  section: 'sections',
  entry: 'entries',
  bullet: 'bullets',
  line: 'lines',
};

/** "b1, b2 are bullets in e1", "e1 is an entry in s2". */
function describeHandles(handles: string[], place: HandlePlace): string {
  const what =
    handles.length > 1 ? `are ${KIND_PLURAL[place.kind]}` : `is ${ONE_OF_KIND[place.kind]}`;
  return `${handles.join(', ')} ${what}${place.holder ? ` in ${place.holder}` : ''}`;
}

const listHandles = (list: Handled[]) => list.map((each) => each.handle).join(', ') || 'nothing';

/** One item as the read writes it, marked "new" or "moved". */
function formatItem(item: Handled, kind: HandleKind, mark: string | undefined): string {
  const tag = mark ? `${item.handle}, ${mark}` : item.handle;
  if (kind === 'section') return `## ${(item as EvalSection).label} (${tag})`;
  if (kind === 'entry') return `### ${(item as EvalEntry).heading} (${tag})`;
  return `- ${item.handle}${mark ? ` (${mark})` : ''}: ${(item as EvalText).text}`;
}

/** "s3's lines", or "the sections". */
const describeList = (place: HandlePlace) =>
  place.holder ? `${place.holder}'s ${KIND_PLURAL[place.kind]}` : 'the sections';

interface MadeOrMoved {
  /** What `short` names: the handle, or a reorder's whole order. */
  shortFor: string;
  marked: string[];
  mark: 'new' | 'moved';
  /** "Suggested l4, a new line in s3". */
  made: string;
  /** What `echo` adds after it: the text, or the list's new order. */
  detail: string;
}

/** The answer of a tool that makes or moves something, in the setting's style. */
function answerMadeOrMoved(
  resume: EvalResume,
  { answers }: AddEvalSettings,
  change: MadeOrMoved
): AddEvalToolAnswer {
  if (answers === 'short') return suggested(change.shortFor);
  const place = findHandlePlace(resume, change.marked[0])!;
  const marks = new Map(change.marked.map((handle) => [handle, change.mark]));
  const list = place.list.map((item) => formatItem(item, place.kind, marks.get(item.handle)));
  const body =
    answers === 'echo' ? `${change.made}: ${change.detail}` : `${change.made}:\n${list.join('\n')}`;
  return { answer: `${body}\nChecks: none.`, isRefused: false };
}

/** A new bullet, line or entry, answered in the setting's style. */
function answerMade(resume: EvalResume, settings: AddEvalSettings, handle: string, text: string) {
  const place = findHandlePlace(resume, handle)!;
  return answerMadeOrMoved(resume, settings, {
    shortFor: handle,
    marked: [handle],
    mark: 'new',
    made: `Suggested ${handle}, a new ${place.kind} in ${place.holder}`,
    detail: `"${text}"`,
  });
}

/** Moved or reordered items, answered in the setting's style. */
function answerMoved(
  resume: EvalResume,
  settings: AddEvalSettings,
  marked: string[],
  shortFor: string
) {
  const place = findHandlePlace(resume, marked[0])!;
  const isOne = marked.length === 1;
  return answerMadeOrMoved(resume, settings, {
    shortFor,
    marked,
    mark: 'moved',
    made: isOne
      ? `Suggested moving ${marked[0]}`
      : `Suggested a new order for ${describeList(place)}`,
    detail: `${describeList(place)} would be ${listHandles(place.list)}`,
  });
}

/** The list a bullet or line sits in, and the item. */
function findText(resume: EvalResume, handle: string) {
  const lists = [
    ...resume.sections.map((section) => section.lines),
    ...listEntries(resume).map((entry) => entry.bullets),
  ];
  for (const list of lists) {
    const item = list.find((each) => each.handle === handle);
    if (item) return { list, item };
  }
  return undefined;
}

function findShowable(resume: EvalResume, handle: string) {
  return findSection(resume, handle) ?? findEntry(resume, handle) ?? findText(resume, handle)?.item;
}

const isSameOrder = (list: Handled[], order: string[]) =>
  list.map((each) => each.handle).join() === order.join();

/** Where in `list` a new item goes: after a handle in it, first, or last; null if not in it. */
function findInsertIndex(list: Handled[], after: string): number | null {
  if (after === 'start') return 0;
  if (!after) return list.length;
  const index = list.findIndex((each) => each.handle === after);
  if (index !== -1) return index + 1;
  // Words where a handle goes: one reading when exactly one item in the list has them.
  const byWords = list.flatMap((each, i) => (hasSameWords(readWords(each), after) ? [i] : []));
  return byWords.length === 1 ? byWords[0] + 1 : null;
}

/** What the read shows of an item: a bullet's or line's text, a heading, a label. */
function readWords(item: Handled): string {
  if ('text' in item) return (item as EvalText).text;
  if ('heading' in item) return (item as EvalEntry).heading;
  return (item as EvalSection).label;
}

const proposeRewrite: RunTool = (resume, args) => {
  const id = readString(args.id);
  const text = readString(args.text);
  if (findSection(resume, id)) return refuse('To change a heading, use propose_rename.');
  const found = findText(resume, id);
  if (!found) {
    return refuse(`"${id}" can't be used here. Use a bullet or line handle, such as b1 or l1.`);
  }
  if (!text) return refuse('text is needed.');
  if (hasSameWords(found.item.text, text)) {
    return answerNoChange(resume, id, `${id} reads that`, `That is ${id}'s text as it is.`);
  }
  found.item.text = text;
  markSuggested(resume, id);
  return suggested(id);
};

const proposeRename: RunTool = (resume, args) => {
  const section = findSection(resume, readString(args.sectionId));
  const label = readString(args.label);
  if (!section) {
    return refuse(`No section "${readString(args.sectionId)}". Use a section handle, such as s1.`);
  }
  if (!label) return refuse('label is needed.');
  if (hasSameWords(section.label, label)) {
    const what = `${section.handle} is called "${section.label}"`;
    return answerNoChange(resume, section.handle, what, `${what} already.`);
  }
  section.label = label;
  markSuggested(resume, section.handle);
  return suggested(section.handle);
};

const proposeReplaceEverywhere: RunTool = (resume, args) => {
  const find = readString(args.find);
  const replace = readString(args.replace);
  const texts = [
    ...resume.sections.flatMap((section) => section.lines),
    ...listEntries(resume).flatMap((entry) => entry.bullets),
  ];
  const changed = texts.filter((item) => {
    const replaced = replaceEveryWholeWord(item.text, find, replace);
    if (replaced) item.text = replaced.text.replace(/ {2,}/g, ' ').trim();
    return Boolean(replaced);
  });
  if (!find || changed.length === 0) {
    return refuse(`"${find}" is in no bullet or line. Copy find exactly as the resume writes it.`);
  }
  return suggested(changed.map((item) => item.handle).join(', '));
};

const answerUnscored: RunTool = () => ({
  answer: 'Suggested.\nChecks: none.',
  isRefused: false,
  isUnscored: true,
});

/** The list `propose_reorder` names: the sections, a section's items, or an entry's bullets. */
function findOrderedList(resume: EvalResume, args: Args): Handled[] | string {
  const sectionId = readString(args.sectionId);
  const entryId = readString(args.entryId);
  if (!sectionId) {
    return entryId ? 'Give the sectionId of the section the entry is in.' : resume.sections;
  }
  const section = findSection(resume, sectionId);
  if (!section) return `No section "${sectionId}". Use a section handle, such as s1.`;
  if (!entryId) return section.layout === 'lines' ? section.lines : section.entries;
  const entry = section.entries.find((each) => each.handle === entryId);
  return entry ? entry.bullets : `${entryId} isn't in that section.`;
}

/** The builder's reorder: the one list the order's handles are in, or what they are. */
function findListOfOrder(resume: EvalResume, order: string[]): Handled[] | string {
  const groups = new Map<Handled[], { place: HandlePlace; handles: string[] }>();
  for (const handle of order) {
    const place = findHandlePlace(resume, handle);
    if (!place) return `${handle} isn't in the resume.`;
    const group = groups.get(place.list) ?? { place, handles: [] };
    group.handles.push(handle);
    groups.set(place.list, group);
  }
  const [first, ...others] = [...groups.values()];
  if (!first) return 'order is empty.';
  if (others.length === 0) return first.place.list;
  const described = [first, ...others].map((group) => describeHandles(group.handles, group.place));
  return `order mixes lists: ${described.join('; ')}. order is the handles of one list.`;
}

const proposeReorder: RunTool = (resume, args, toolSet) => {
  const order = readStrings(args.order);
  const list = toolSet.isBuilder ? findListOfOrder(resume, order) : findOrderedList(resume, args);
  if (typeof list === 'string') return refuse(list);
  const isEveryOnce =
    order.length === list.length && list.every((each) => order.includes(each.handle));
  if (!isEveryOnce) {
    return refuse(
      `That list holds ${listHandles(list)}; order gives ${order.join(', ')}. order is every one of them, once.`
    );
  }
  const key = orderKey(findHandlePlace(resume, list[0].handle)!);
  if (isSameOrder(list, order)) {
    return answerNoChange(resume, key, 'that order', 'That is the order the list has now.');
  }
  const movedHandles = order.filter((handle, index) => list[index].handle !== handle);
  const reordered = order.map((handle) => list.find((each) => each.handle === handle)!);
  list.splice(0, list.length, ...reordered);
  markSuggested(resume, key);
  return answerMoved(resume, toolSet, movedHandles, order.join(', '));
};

/** Where `before` or `after` puts `id` among the rest of its list, or the problem. */
function findPlaceIndex(list: Handled[], id: string, side: 'before' | 'after', target: string) {
  if (side === 'after' && target === 'start') return 0;
  if (target === id) return `${id} can't go ${side} itself.`;
  const rest = list.filter((each) => each.handle !== id);
  const index = rest.findIndex((each) => each.handle === target);
  if (index === -1) return `${target} isn't in ${id}'s list, which holds ${listHandles(list)}.`;
  return side === 'before' ? index : index + 1;
}

/**
 * Where `propose_move` puts `id`: by `before`, by `after`, or by both when they name the
 * same place; when they name two, it says where each would put it.
 */
function findMoveIndex(list: Handled[], id: string, args: Args): number | string {
  const before = readString(args.before);
  const after = readString(args.after);
  if (!before && !after) return 'Give before or after: where it goes.';
  const byBefore = before ? findPlaceIndex(list, id, 'before', before) : null;
  const byAfter = after ? findPlaceIndex(list, id, 'after', after) : null;
  if (typeof byBefore === 'string') return byBefore;
  if (typeof byAfter === 'string') return byAfter;
  if (byBefore !== null && byAfter !== null && byBefore !== byAfter) {
    return `before ${before} puts ${id} at place ${byBefore + 1}; after ${after} puts it at place ${byAfter + 1}. They name two places.`;
  }
  return (byBefore ?? byAfter)!;
}

const proposeMove: RunTool = (resume, args, toolSet) => {
  const id = readString(args.id);
  const place = findHandlePlace(resume, id);
  if (!place) return refuse(`${id} isn't in the resume.`);
  const { list } = place;
  const index = findMoveIndex(list, id, args);
  if (typeof index === 'string') return refuse(index);
  const moving = list.find((each) => each.handle === id)!;
  const reordered = list.filter((each) => each !== moving);
  reordered.splice(index, 0, moving);
  const newOrder = reordered.map((each) => each.handle);
  if (isSameOrder(list, newOrder)) {
    return answerNoChange(resume, orderKey(place), `${id} there`, `${id} is already there.`);
  }
  list.splice(0, list.length, ...reordered);
  markSuggested(resume, orderKey(place));
  return answerMoved(resume, toolSet, [id], id);
};

const proposeSelect: RunTool = (resume, args) => {
  const id = readString(args.id);
  const target = findShowable(resume, id);
  if (!target) {
    return refuse(`No bullet, line, entry or section "${id}". Use a handle from the resume.`);
  }
  if (typeof args.show !== 'boolean') return refuse('show is true or false.');
  if (target.isShown === args.show) {
    const what = `${id} ${args.show ? 'on' : 'off'} the page`;
    return answerNoChange(
      resume,
      id,
      what,
      `${id} is already ${args.show ? 'on' : 'off'} the page.`
    );
  }
  target.isShown = args.show;
  markSuggested(resume, id);
  return suggested(id);
};

function formatEntryHeading(args: Args): string {
  const name = [readString(args.title), readString(args.organization), readString(args.location)]
    .filter(Boolean)
    .join(', ');
  return [name, readString(args.dates)].filter(Boolean).join(' · ') || 'Untitled entry';
}

/** Puts an entry built from `args` into `entries` at `index`, with its bullets. */
function insertEntry(resume: EvalResume, entries: EvalEntry[], index: number, args: Args) {
  const entry: EvalEntry = {
    handle: nextEvalHandle(resume, 'entry'),
    heading: formatEntryHeading(args),
    isShown: true,
    bullets: [],
  };
  entries.splice(index, 0, entry);
  for (const text of readStrings(args.bullets)) {
    entry.bullets.push({ handle: nextEvalHandle(resume, 'bullet'), text, isShown: true });
  }
  return entry;
}

const isEmpty = (section: EvalSection) =>
  section.lines.length === 0 && section.entries.length === 0;

/**
 * Where a new entry goes: the builder's `after` (left out, last), or the shipped
 * `afterEntryId` (left out, first). Null when it names an entry not in the section.
 */
function findEntryIndex(entries: EvalEntry[], args: Args, toolSet: AddEvalSettings) {
  if (toolSet.isBuilder) return findInsertIndex(entries, readString(args.after));
  const afterEntryId = readString(args.afterEntryId);
  const afterIndex = entries.findIndex((entry) => entry.handle === afterEntryId);
  return afterEntryId && afterIndex === -1 ? null : afterIndex + 1;
}

const proposeEntry: RunTool = (resume, args, toolSet) => {
  const section = findSection(resume, readString(args.sectionId));
  if (!section) {
    return refuse(`No section "${readString(args.sectionId)}". Use a section handle, such as s1.`);
  }
  if (section.layout === 'lines' && !(section.kind === 'custom' && isEmpty(section))) {
    const withEntries = resume.sections.filter((each) => each.layout === 'entries');
    return refuse(
      `${section.handle} holds lines; propose_add adds lines. The sections that hold entries are ${listHandles(withEntries)}.`
    );
  }
  const index = findEntryIndex(section.entries, args, toolSet);
  if (index === null) {
    const placeArg = toolSet.isBuilder ? args.after : args.afterEntryId;
    return refuse(
      `${readString(placeArg)} isn't in ${section.handle}, whose entries are ${listHandles(section.entries)}.`
    );
  }
  section.layout = 'entries';
  const entry = insertEntry(resume, section.entries, index, args);
  return answerMade(resume, toolSet, entry.handle, entry.heading);
};

/**
 * The bullets of an entry or the lines of a lines section, for new text to go into. An
 * empty custom section takes the layout of what goes in first.
 */
function findTextContainer(resume: EvalResume, handle: string): TextContainer | string {
  const entry = findEntry(resume, handle);
  if (entry) return { holder: entry.handle, list: entry.bullets, kind: 'bullet' };
  const section = findSection(resume, handle);
  if (section?.kind === 'custom' && isEmpty(section)) section.layout = 'lines';
  if (section?.layout === 'lines')
    return { holder: section.handle, list: section.lines, kind: 'line' };
  const [onlyEntry, ...otherEntries] = section?.entries ?? [];
  if (onlyEntry && otherEntries.length === 0) {
    const took = `Took ${handle} as its one entry, ${onlyEntry.handle}.`;
    return { holder: onlyEntry.handle, list: onlyEntry.bullets, kind: 'bullet', took };
  }
  if (section) {
    return `${handle} holds entries, ${listHandles(section.entries)}: a new bullet goes into one of them, and propose_entry makes a new entry.`;
  }
  const place = findHandlePlace(resume, handle);
  if (place) {
    return `${describeHandles([handle], place)}. propose_add makes a new one; propose_rewrite changes one.`;
  }
  return `${handle} isn't in the resume.`;
}

/** Where new text goes: the entry's bullets or the section's lines, and what was taken. */
interface TextContainer {
  holder: string;
  list: EvalText[];
  kind: 'bullet' | 'line';
  took?: string;
}

/** An answer with what was taken to reach it said first. */
const withTook = (answer: AddEvalToolAnswer, took: string | undefined): AddEvalToolAnswer =>
  took ? { ...answer, answer: `${took}\n${answer.answer}` } : answer;

const LIST_SEPARATORS = [', ', ' · ', ' | ', ' / ', '; '];

/**
 * A new item in a line that lists things, placed after an item as the line writes it, or
 * first, or last, and joined with the line's own separator. Our code writes the line, so
 * the result holds exactly the item asked for.
 */
function addListItem(resume: EvalResume, line: EvalText, args: Args): AddEvalToolAnswer {
  const item = readString(args.text);
  if (!item) return refuse('text is needed: the new item.');
  const separator = LIST_SEPARATORS.find((each) => line.text.includes(each));
  if (!separator) {
    return refuse(
      `${line.handle} has no separator (${LIST_SEPARATORS.map((each) => `"${each.trim()}"`).join(' ')}), so it isn't a list. propose_rewrite changes it.`
    );
  }
  const items = line.text.split(separator);
  const repeated = items.find((each) => hasSameWords(each, item));
  if (repeated) {
    const fact = `${line.handle} already lists "${repeated}".`;
    return answerNoChange(resume, line.handle, `"${repeated}" in ${line.handle}`, fact);
  }
  const after = readString(args.after);
  const afterIndex = items.findIndex((each) => hasSameWords(each, after));
  if (after && after !== 'start' && afterIndex === -1) {
    return refuse(
      `"${after}" isn't an item of ${line.handle}, which lists ${items.join(separator)}.`
    );
  }
  const index = after === 'start' ? 0 : after ? afterIndex + 1 : items.length;
  items.splice(index, 0, item);
  line.text = items.join(separator);
  markSuggested(resume, line.handle);
  return suggested(line.handle);
}

const proposeAdd: RunTool = (resume, args, toolSet) => {
  const text = readString(args.text);
  const listLine = resume.sections
    .flatMap((section) => section.lines)
    .find((line) => line.handle === readString(args.into));
  if (listLine && toolSet.isBuilder) return addListItem(resume, listLine, args);
  const container = findTextContainer(resume, readString(args.into));
  if (typeof container === 'string') return refuse(container);
  const { holder, list, kind, took } = container;
  if (!text) return refuse('text is needed.');
  const repeated = list.find((item) => hasSameWords(item.text, text));
  if (repeated) {
    const what = `${repeated.handle} in ${holder}`;
    const fact = `${holder} already has that, as ${repeated.handle}.`;
    return withTook(answerNoChange(resume, repeated.handle, what, fact), took);
  }
  const index = findInsertIndex(list, readString(args.after));
  if (index === null) {
    return refuse(
      `${readString(args.after)} isn't in ${holder}, which holds ${listHandles(list)}.`
    );
  }
  const handle = nextEvalHandle(resume, kind);
  list.splice(index, 0, { handle, text, isShown: true });
  markSuggested(resume, handle);
  return withTook(answerMade(resume, toolSet, handle, text), took);
};

const listTexts = (resume: EvalResume) => [
  ...resume.sections.flatMap((section) => section.lines),
  ...listEntries(resume).flatMap((entry) => entry.bullets),
];

/** What reading a call's arguments needs of this resume (`readEvalToolArgs.ts`). */
export function lookUpEvalResume(resume: EvalResume): ResumeLookup {
  return {
    findByText: (text) => findHandleByText(resume, text),
    holds: (holder, handle) => holdsHandle(resume, holder, handle),
  };
}

/** Whether `holder` holds `handle`, directly or through an entry. */
function holdsHandle(resume: EvalResume, holder: string, handle: string): boolean {
  const heldBy = findHandlePlace(resume, handle)?.holder;
  if (!heldBy) return false;
  return heldBy === holder || holdsHandle(resume, holder, heldBy);
}

/** The handle of the one bullet, line, section or entry with these words, if one has them. */
function findHandleByText(resume: EvalResume, text: string): string | null {
  const named = [
    ...resume.sections.map((section) => ({ handle: section.handle, words: section.label })),
    ...listEntries(resume).map((entry) => ({ handle: entry.handle, words: entry.heading })),
    ...listTexts(resume).map((item) => ({ handle: item.handle, words: item.text })),
  ];
  const matches = named.filter((each) => hasSameWords(each.words, text));
  return matches.length === 1 ? matches[0].handle : null;
}

const hasEntryArgs = (args: Args) =>
  ['title', 'organization', 'location', 'dates'].some((key) => readString(args[key])) ||
  readStrings(args.bullets).length > 0;

const isBuiltInKind = (kind: string): kind is BuiltInSectionKind => kind in SECTION_PRESETS;

const buildSection = (
  resume: EvalResume,
  kind: SectionKind,
  layout: EvalSection['layout'],
  label: string
): EvalSection => ({
  handle: nextEvalHandle(resume, 'section'),
  kind,
  layout,
  label,
  isShown: true,
  lines: [],
  entries: [],
});

/** The contents a one-call `propose_section` must bring, or the problem with them. */
function checkSectionContents(kind: string, args: Args): string | null {
  const lines = readStrings(args.lines);
  if (lines.length > 0 && hasEntryArgs(args)) return 'Give lines or an entry, not both.';
  if (lines.length === 0 && !hasEntryArgs(args)) {
    return 'A new section needs its first lines or its first entry.';
  }
  if (!isBuiltInKind(kind)) return null;
  const preset = SECTION_PRESETS[kind];
  if (preset.layout === 'lines' && lines.length === 0) {
    return `A ${preset.label} section holds lines: give lines, not an entry.`;
  }
  if (preset.layout === 'entries' && lines.length > 0) {
    return `A ${preset.label} section holds entries: give its first entry's title, organization, dates and bullets, not lines.`;
  }
  return null;
}

/** The section `propose_section` describes, before its contents, or the problem. */
function readNewSection(resume: EvalResume, args: Args, toolSet: AddEvalSettings) {
  const kind = readString(args.kind);
  if (!SECTION_KINDS.includes(kind)) return `kind must be one of ${SECTION_KINDS.join(', ')}.`;
  const problem = toolSet.isBuilder ? null : checkSectionContents(kind, args);
  if (problem) return problem;
  const label = readString(args.label);
  if (!isBuiltInKind(kind)) {
    if (!label) return 'A custom section needs its label.';
    const layout = readStrings(args.lines).length > 0 ? 'lines' : 'entries';
    return buildSection(resume, 'custom', layout, label);
  }
  const existing = resume.sections.find((section) => section.kind === kind);
  if (existing) {
    return `There is already a ${existing.label} section, ${existing.handle}. Add to it with propose_add or propose_entry.`;
  }
  const preset = SECTION_PRESETS[kind];
  return buildSection(resume, kind, preset.layout, label || preset.label);
}

/** What the builder's answer tells the model to do next with the empty section. */
function describeEmptySection(section: EvalSection): string {
  const into = section.handle;
  const holds = section.kind === 'custom' ? 'custom' : section.layout;
  const FILL: Record<typeof holds, string> = {
    lines: `add its lines with propose_add (into ${into})`,
    entries: `add its first entry with propose_entry (sectionId ${into})`,
    custom: `add its first entry with propose_entry (sectionId ${into}), or lines with propose_add (into ${into})`,
  };
  return `Suggested ${into}, a new ${section.label} section. It is empty: ${FILL[holds]}.`;
}

const proposeSection: RunTool = (resume, args, toolSet) => {
  const section = readNewSection(resume, args, toolSet);
  if (typeof section === 'string') return refuse(section);
  const index = findInsertIndex(resume.sections, readString(args.after));
  if (index === null) {
    return refuse(`No section "${readString(args.after)}". Use a section handle, such as s1.`);
  }
  resume.sections.splice(index, 0, section);
  if (toolSet.isBuilder) {
    return { answer: describeEmptySection(section), isRefused: false };
  }
  if (section.layout === 'entries') insertEntry(resume, section.entries, 0, args);
  for (const text of readStrings(args.lines)) {
    section.lines.push({ handle: nextEvalHandle(resume, 'line'), text, isShown: true });
  }
  return suggested(section.handle);
};

const RUN_TOOL: Record<string, RunTool> = {
  propose_rewrite: proposeRewrite,
  propose_rename: proposeRename,
  propose_replace_everywhere: proposeReplaceEverywhere,
  propose_split: answerUnscored,
  propose_merge: answerUnscored,
  propose_reorder: proposeReorder,
  propose_move: proposeMove,
  propose_select: proposeSelect,
  propose_entry: proposeEntry,
  propose_add: proposeAdd,
  propose_section: proposeSection,
};

export function runAddEvalTool(
  resume: EvalResume,
  toolSet: AddEvalSettings,
  name: string,
  args: unknown
): AddEvalToolAnswer {
  const runTool = RUN_TOOL[name];
  if (!runTool) return refuse(`No tool ${name}.`);
  const record = typeof args === 'object' && args !== null ? (args as Args) : {};
  return runTool(resume, record, toolSet);
}

/** New sections the run left empty, which the app won't let it finish with. */
export function listEmptyNewSections(before: EvalResume, after: EvalResume): EvalSection[] {
  const handlesBefore = new Set(before.sections.map((section) => section.handle));
  return after.sections.filter((section) => !handlesBefore.has(section.handle) && isEmpty(section));
}
