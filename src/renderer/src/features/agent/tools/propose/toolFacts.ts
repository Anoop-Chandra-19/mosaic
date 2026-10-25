import { describeHandleKinds, type HandleKind } from '@shared/agent-tools/handleKinds';

/*
 * What a propose call hears when it can't be turned into one change, by kind of problem.
 * Every one says what is so, and which tool does the other thing, never a guess at what
 * the model meant: the model works out the fix from the facts, as it would from a
 * compiler's error. A tool or a finder picks the row; the wording lives only here.
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
      ? `${section} holds lines, not entries. The sections that hold entries are ${listHandles(sectionsWithEntries)}.`
      : `${section} holds lines, not entries, and no section holds entries.`,
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
  phraseNotInBullet: (phrase: string, bullet: string) =>
    `"${phrase}" is not in ${bullet}. Copy it exactly.`,
  termInNoText: (find: string) =>
    `"${find}" is in no bullet or line. Copy find exactly as the resume writes it.`,
};
