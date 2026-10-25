/**
 * Whether the add eval's resume, after the model's calls, is one of the outcomes a case
 * accepts: what changed, what was added and where, what left the page, what moved. Nothing
 * else may change, so a right edit beside a wrong one scores as wrong.
 */
import type { EvalResume, EvalSection, EvalText } from './addEvalResume.ts';
import type { AddOutcome, ExpectedNew, ExpectedSection } from './fixtures/addCases.ts';

interface NewThing {
  into: string;
  /** The handle before it, or "start". */
  after: string;
  text: string;
}

interface NewSection extends NewThing {
  kind: string;
  label: string;
  lineCount: number;
}

export interface AddEvalChanges {
  /** Existing bullets, lines and headings with new text. */
  changed: Map<string, string>;
  added: NewThing[];
  newEntries: NewThing[];
  newSections: NewSection[];
  /** Handles whose place on the page flipped. */
  hidden: string[];
  shown: string[];
  /** Lists whose original items are in a new order: "sections", or the container's handle. */
  orders: Map<string, string[]>;
}

const holdsWords = (text: string, words: string[] = []) =>
  words.every((word) => text.toLowerCase().includes(word.toLowerCase()));

const previousHandle = (list: { handle: string }[], index: number) =>
  index === 0 ? 'start' : list[index - 1].handle;

/** Each list the resume holds, keyed as `AddEvalChanges.orders` keys them. */
function listLists(resume: EvalResume): Map<string, { handle: string }[]> {
  const lists = new Map<string, { handle: string }[]>([['sections', resume.sections]]);
  for (const section of resume.sections) {
    lists.set(section.handle, section.layout === 'lines' ? section.lines : section.entries);
    for (const entry of section.entries) lists.set(entry.handle, entry.bullets);
  }
  return lists;
}

function listTexts(resume: EvalResume): EvalText[] {
  return resume.sections.flatMap((section) => [
    ...section.lines,
    ...section.entries.flatMap((entry) => entry.bullets),
  ]);
}

const describeSectionText = (section: EvalSection) =>
  [
    ...section.lines.map((line) => line.text),
    ...section.entries.flatMap((entry) => [entry.heading, ...entry.bullets.map((b) => b.text)]),
  ].join(' | ');

/** Everything that differs between the resume as the model read it and as it left it. */
export function listAddEvalChanges(before: EvalResume, after: EvalResume): AddEvalChanges {
  const changes: AddEvalChanges = {
    changed: new Map(),
    added: [],
    newEntries: [],
    newSections: [],
    hidden: [],
    shown: [],
    orders: new Map(),
  };
  const beforeLists = listLists(before);
  const beforeTexts = new Map(listTexts(before).map((item) => [item.handle, item.text]));
  for (const item of listTexts(after)) {
    const text = beforeTexts.get(item.handle);
    if (text !== undefined && text !== item.text) changes.changed.set(item.handle, item.text);
  }
  for (const section of after.sections) {
    const original = before.sections.find((each) => each.handle === section.handle);
    if (original && original.label !== section.label) {
      changes.changed.set(section.handle, section.label);
    }
  }

  const shownBefore = new Map<string, boolean>();
  for (const showable of listShowables(before)) shownBefore.set(showable.handle, showable.isShown);
  for (const showable of listShowables(after)) {
    const wasShown = shownBefore.get(showable.handle);
    if (wasShown === true && !showable.isShown) changes.hidden.push(showable.handle);
    if (wasShown === false && showable.isShown) changes.shown.push(showable.handle);
  }

  for (const [key, list] of listLists(after)) {
    const original = beforeLists.get(key);
    if (!original) continue;
    const originalHandles = original.map((each) => each.handle);
    const keptOrder = list.map((each) => each.handle).filter((h) => originalHandles.includes(h));
    if (keptOrder.join() !== originalHandles.join()) changes.orders.set(key, keptOrder);

    list.forEach((item, index) => {
      if (originalHandles.includes(item.handle)) return;
      const placed = { into: key, after: previousHandle(list, index) };
      if (key === 'sections') {
        const section = item as EvalSection;
        changes.newSections.push({
          ...placed,
          kind: section.kind,
          label: section.label,
          lineCount: section.lines.length,
          text: describeSectionText(section),
        });
      } else if ('bullets' in item) {
        const entry = item as EvalSection['entries'][number];
        const text = [entry.heading, ...entry.bullets.map((b) => b.text)].join(' | ');
        changes.newEntries.push({ ...placed, text });
      } else {
        changes.added.push({ ...placed, text: (item as EvalText).text });
      }
    });
  }
  return changes;
}

function listShowables(resume: EvalResume) {
  return [
    ...resume.sections,
    ...resume.sections.flatMap((section) => section.entries),
    ...listTexts(resume),
  ];
}

const isPlacedAsExpected = (got: NewThing, want: ExpectedNew) =>
  got.into === want.into && (want.after === undefined || got.after === want.after);

const isSectionAsExpected = (got: NewSection, want: ExpectedSection) =>
  got.kind === want.kind &&
  holdsWords(got.label, want.labelHas) &&
  (want.after === undefined || got.after === want.after) &&
  (want.lineCount === undefined || got.lineCount === want.lineCount) &&
  holdsWords(got.text, want.has);

/** Pairs each expected thing with a different one found, in any order. */
function matchesEach<Got, Want>(
  found: Got[],
  wanted: Want[] = [],
  isMatch: (got: Got, want: Want) => boolean
): boolean {
  if (found.length !== wanted.length) return false;
  const unused = [...found];
  return wanted.every((want) => {
    const index = unused.findIndex((got) => isMatch(got, want));
    if (index === -1) return false;
    unused.splice(index, 1);
    return true;
  });
}

const sameHandles = (found: string[], wanted: string[] = []) =>
  [...found].sort().join() === [...wanted].sort().join();

export function matchesAddOutcome(changes: AddEvalChanges, outcome: AddOutcome): boolean {
  const changed = outcome.changed ?? {};
  const orders = outcome.orders ?? {};
  return (
    sameHandles([...changes.changed.keys()], Object.keys(changed)) &&
    [...changes.changed].every(([handle, text]) => holdsWords(text, changed[handle])) &&
    matchesEach(
      changes.added,
      outcome.added,
      (got, want) => isPlacedAsExpected(got, want) && holdsWords(got.text, want.has)
    ) &&
    matchesEach(
      changes.newEntries,
      outcome.newEntries,
      (got, want) => isPlacedAsExpected(got, want) && holdsWords(got.text, want.has)
    ) &&
    matchesEach(changes.newSections, outcome.newSections, isSectionAsExpected) &&
    sameHandles(changes.hidden, outcome.hidden) &&
    sameHandles(changes.shown, outcome.shown) &&
    sameHandles([...changes.orders.keys()], Object.keys(orders)) &&
    [...changes.orders].every(([key, order]) => order.join() === orders[key]?.join())
  );
}

/** One line per change, for a row that scored wrong. */
export function describeAddEvalChanges(changes: AddEvalChanges): string[] {
  return [
    ...[...changes.changed].map(([handle, text]) => `${handle} now: ${JSON.stringify(text)}`),
    ...changes.added.map((n) => `added to ${n.into} after ${n.after}: ${JSON.stringify(n.text)}`),
    ...changes.newEntries.map(
      (n) => `new entry in ${n.into} after ${n.after}: ${JSON.stringify(n.text)}`
    ),
    ...changes.newSections.map(
      (n) => `new ${n.kind} section "${n.label}" after ${n.after}: ${JSON.stringify(n.text)}`
    ),
    ...changes.hidden.map((handle) => `${handle} off the page`),
    ...changes.shown.map((handle) => `${handle} back on the page`),
    ...[...changes.orders].map(([key, order]) => `${key} order: ${order.join(', ')}`),
  ];
}
