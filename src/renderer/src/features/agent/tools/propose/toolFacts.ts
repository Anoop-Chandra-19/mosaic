import { describeHandleKinds, type HandleKind } from '@shared/agent-tools/handleKinds';

/*
 * Centralized problem messages for propose calls. Tools and receipt finders select
 * a message that states the relevant facts and, where useful, points to another tool.
 * Do not guess the model's intent; give it enough information to correct the call.
 */

/** "b1, b2, b3", or "nothing". */
export const listHandles = (handles: readonly string[]) => handles.join(', ') || 'nothing';

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

/** "b1, b2 are bullets in e1", "e1 is an entry in s2", "s1 is a section". */
export function describeHandlesInList(
  handles: string[],
  kind: HandleKind,
  holder: string | null
): string {
  const what = handles.length > 1 ? `are ${KIND_PLURAL[kind]}` : `is ${ONE_OF_KIND[kind]}`;
  return `${handles.join(', ')} ${what}${holder ? ` in ${holder}` : ''}`;
}

/** "e1's bullets", "s3's lines", or "the sections". */
export const describeList = (kind: HandleKind, holder: string | null) =>
  holder ? `${holder}'s ${KIND_PLURAL[kind]}` : 'the sections';

/** The call that adds to a section, by what the section holds. */
const HOW_TO_FILL = {
  lines: (section: string) => `propose_add (into ${section})`,
  entries: (section: string) => `propose_entry (sectionId ${section})`,
};

/** What an empty new section still needs, by what it can hold. */
const EMPTY_SECTION_NEEDS = {
  lines: (section: string) => `its lines with ${HOW_TO_FILL.lines(section)}`,
  entries: (section: string) => `its first entry with ${HOW_TO_FILL.entries(section)}`,
  either: (section: string) =>
    `its first entry with ${HOW_TO_FILL.entries(section)}, or its lines with ${HOW_TO_FILL.lines(section)}`,
};

const MERGE_RULE = 'propose_merge joins two bullets next to each other in one entry.';

export const TOOL_FACTS = {
  notRead: 'Read the resume first, with read_document.',
  otherResumeOpen: 'Another resume is open now. Read it with read_document.',
  unknownHandle: (kind: HandleKind, handle: string) =>
    `No ${kind} "${handle}". Use ${describeHandleKinds([kind])}.`,
  wrongKind: (handle: string, kinds: readonly HandleKind[]) =>
    `"${handle}" can't be used here. Use ${describeHandleKinds(kinds)}.`,
  notInReceipt: (handle: string) =>
    `${handle} isn't in the resume as you last read it. Read it again.`,
  entryNotInSection: (handle: string, section: string, entries: string[]) =>
    `${handle} isn't in ${section}, whose entries are ${listHandles(entries)}.`,
  sectionHoldsLines: (section: string, sectionsWithEntries: string[]) =>
    sectionsWithEntries.length
      ? `${section} holds lines, not entries; propose_add adds a line. The sections that hold entries are ${listHandles(sectionsWithEntries)}.`
      : `${section} holds lines, not entries; propose_add adds a line. No section holds entries.`,
  sectionHoldsEntries: (section: string, entries: string[]) =>
    `${section} holds entries, ${listHandles(entries)}. A new bullet goes into one of them, and propose_entry makes a new entry.`,
  customSectionNeedsLabel: 'A custom section needs label, its heading.',
  oneSummary: (summary: string) =>
    `A resume has one Summary, and ${summary} is it. propose_rewrite changes what it says.`,
  sectionExists: (label: string, section: string, layout: 'entries' | 'lines') =>
    `There is already a section named ${label}, ${section}. ${HOW_TO_FILL[layout](section)} adds to it.`,
  emptySection: (section: string, holds: 'entries' | 'lines' | 'either') =>
    `It is ${section}, and it is empty: add ${EMPTY_SECTION_NEEDS[holds](section)}.`,
  notInList: (handle: string, list: string, holds: string[]) =>
    `${handle} isn't in ${list}, which holds ${listHandles(holds)}.`,
  lineIsNotAList: (line: string, separators: readonly string[]) =>
    `${line} has no separator (${separators.map((each) => `"${each.trim()}"`).join(' ')}), so it isn't a list. propose_rewrite changes it.`,
  notAnItem: (after: string, line: string, lineText: string) =>
    `"${after}" isn't an item of ${line}, which reads: "${lineText}".`,
  bulletsInTwoEntries: (first: string, firstEntry: string, second: string, secondEntry: string) =>
    `${first} is in ${firstEntry} and ${second} is in ${secondEntry}. ${MERGE_RULE}`,
  bulletsApart: (first: string, second: string, entry: string, bullets: string[]) =>
    `${first} and ${second} aren't next to each other: ${entry}'s bullets are ${listHandles(bullets)}. ${MERGE_RULE}`,
  orderEmpty: 'order is empty. order is every handle of one list, in the new order.',
  orderRepeats: (handle: string) => `${handle} is in order twice. order names each one once.`,
  orderApart: (list: string, named: string[], between: string[], holds: string[]) =>
    `In ${list}, ${listHandles(between)} ${between.length > 1 ? 'sit' : 'sits'} between ${listHandles(named)}, so their new order can be read more than one way. ${list} holds ${listHandles(holds)}: give all of them in the new order.`,
  gapWithoutNumber:
    'With {{?}} in text, give withoutNumber too: the same text written to need no number.',
  gapInEntryBullet:
    "bullets can't hold {{?}}. Propose the entry without that bullet, then add the bullet with propose_add into the new entry, with withoutNumber.",
  phraseNotInBullet: (phrase: string, bullet: string) =>
    `"${phrase}" is not in ${bullet}. Copy it exactly.`,
  termInNoText: (find: string) =>
    `"${find}" is in no bullet or line. Copy find exactly as the resume writes it.`,
  newerThanKept: (kept: number, waiting: number) =>
    `The user kept version ${kept} of this suggestion, so this is version ${waiting}, which waits for them. read_document shows version ${kept} until they keep version ${waiting}.`,
};
