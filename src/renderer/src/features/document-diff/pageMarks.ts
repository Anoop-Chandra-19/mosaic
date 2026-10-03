import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import type { Change, ChangeTarget } from '@shared/resume/changes/resumeChange';

/**
 * Where marks sit on the page: the name, a header item, a section's heading, an entry or
 * text line, or a bullet.
 */
export type MarkPlace = 'name' | 'item' | 'section' | 'entry' | 'bullet';

/** The changes the page marks, by the thing each sits on, and how hover tips name the other side. */
export interface PageMarks {
  otherSide: string;
  byPlace: Map<string, Change[]>;
}

/** How far into the left margin a mark's bar and move glyph sit, from the marked text. */
export interface MarkGutter {
  barPx: number;
  glyphPx: number;
}

/** A heading's, a section name's, or a text line's: the design's 23px bar, its glyph further out. */
export const LINE_GUTTER: MarkGutter = { barPx: 23, glyphPx: 34 };

function placeKeyOf(target: ChangeTarget): string | null {
  switch (target.type) {
    case 'name':
      return 'name:';
    case 'headerItem':
      return `item:${target.itemId}`;
    case 'section':
      return `section:${target.sectionId}`;
    case 'entry':
    case 'entryField':
    case 'summaryLine':
    case 'textLine':
      return `entry:${target.entryId}`;
    case 'bullet':
      return `bullet:${target.bulletId}`;
  }
}

/** Every change, children included, by where it is marked. */
export function collectPageMarks(changes: readonly Change[], otherSide: string): PageMarks {
  const byPlace = new Map<string, Change[]>();
  for (const change of changes) {
    const key = placeKeyOf(change.target);
    if (key) byPlace.set(key, [...(byPlace.get(key) ?? []), change]);
  }
  return { otherSide, byPlace };
}

export function findMarks(marks: PageMarks | undefined, place: MarkPlace, id: string): Change[] {
  return marks?.byPlace.get(`${place}:${id}`) ?? [];
}

const isGone = (change: Change) => change.kind === 'remove' || change.kind === 'hide';

/** Where a thing goes back: after the nearest earlier sibling both sides still have. */
function insertAfterEarlierSibling<T extends { id: string }>(
  items: T[],
  beforeItems: readonly T[],
  item: T
): void {
  const earlier = beforeItems.slice(
    0,
    beforeItems.findIndex(({ id }) => id === item.id)
  );
  const anchor = earlier.reverse().find(({ id }) => items.some((existing) => existing.id === id));
  const index = anchor ? items.findIndex(({ id }) => id === anchor.id) + 1 : 0;
  items.splice(index, 0, item);
}

function putSectionBack(resume: ResumeData, before: ResumeData, sectionId: string): void {
  const shown = resume.sections.find((section) => section.id === sectionId);
  if (shown) {
    shown.hidden = false;
    return;
  }
  const section = before.sections.find(({ id }) => id === sectionId);
  if (!section) return;
  const byOrder = (sections: ResumeSection[]) => [...sections].sort((a, b) => a.order - b.order);
  const ordered = byOrder(resume.sections);
  insertAfterEarlierSibling(ordered, byOrder(before.sections), {
    ...structuredClone(section),
    hidden: false,
  });
  // Sections print by `order`, so the order follows where it now stands.
  ordered.forEach((each, index) => (each.order = index));
  resume.sections = ordered;
}

function findEntryIn(resume: ResumeData, entryId: string): ResumeEntry | undefined {
  for (const section of resume.sections) {
    const entry = section.items.find(({ id }) => id === entryId);
    if (entry) return entry;
  }
  return undefined;
}

function putEntryBack(resume: ResumeData, before: ResumeData, change: Change): void {
  const { sectionId, entryId } = change.target;
  const beforeSection = before.sections.find(({ id }) => id === sectionId);
  const beforeEntry = beforeSection?.items.find(({ id }) => id === entryId);
  const section = resume.sections.find(({ id }) => id === sectionId);
  if (!section || !beforeSection || !beforeEntry) return;
  const shown = section.items.find(({ id }) => id === entryId);
  if (shown && change.kind === 'hide') {
    shown.selected = true;
    return;
  }
  // Removed, or emptied: what the other side printed goes back in its place.
  const entry = { ...structuredClone(beforeEntry), selected: true };
  if (shown) section.items.splice(section.items.indexOf(shown), 1, entry);
  else insertAfterEarlierSibling(section.items, beforeSection.items, entry);
}

function putBulletBack(resume: ResumeData, before: ResumeData, change: Change): void {
  const { entryId, bulletId } = change.target;
  if (!entryId || !bulletId) return;
  const entry = findEntryIn(resume, entryId);
  const beforeEntry = findEntryIn(before, entryId);
  const beforeBullet = beforeEntry?.bullets.find(({ id }) => id === bulletId);
  if (!entry || !beforeEntry || !beforeBullet) return;
  const shown = entry.bullets.find(({ id }) => id === bulletId);
  if (shown && change.kind === 'hide') {
    shown.selected = true;
    return;
  }
  const bullet = { ...beforeBullet, selected: true };
  if (shown) entry.bullets.splice(entry.bullets.indexOf(shown), 1, bullet);
  else insertAfterEarlierSibling(entry.bullets, beforeEntry.bullets, bullet);
}

function putHeaderItemBack(resume: ResumeData, before: ResumeData, itemId: string): void {
  const beforeLines = before.contact.header.lines;
  const beforeLine = beforeLines.find((line) => line.items.some(({ id }) => id === itemId));
  const beforeItem = beforeLine?.items.find(({ id }) => id === itemId);
  if (!beforeLine || !beforeItem) return;
  const item = { ...beforeItem, shown: true };
  const lines = resume.contact.header.lines;
  // Left off, or emptied: it stands where it is, with what the other side printed.
  for (const line of lines) {
    const index = line.items.findIndex(({ id }) => id === itemId);
    if (index >= 0) {
      line.items.splice(index, 1, item);
      return;
    }
  }
  let line = lines.find(({ id }) => id === beforeLine.id);
  if (!line) {
    line = { ...beforeLine, items: [] };
    insertAfterEarlierSibling(lines, beforeLines, line);
  }
  insertAfterEarlierSibling(line.items, beforeLine.items, item);
}

/**
 * The page being read, with what only the other side printed put back where it stood, so
 * it can be marked struck through in place. Sections go back before their entries, and
 * entries before their bullets, as the changes come in page order.
 */
export function putGoneBack(after: ResumeData, before: ResumeData, changes: readonly Change[]) {
  const resume = structuredClone(after);
  for (const change of changes.filter(isGone)) {
    const { type, sectionId, itemId } = change.target;
    if (type === 'headerItem' && itemId) putHeaderItemBack(resume, before, itemId);
    else if (type === 'section' && sectionId) putSectionBack(resume, before, sectionId);
    else if (type === 'entry' || type === 'summaryLine' || type === 'textLine') {
      putEntryBack(resume, before, change);
    } else if (type === 'bullet') putBulletBack(resume, before, change);
  }
  return resume;
}
