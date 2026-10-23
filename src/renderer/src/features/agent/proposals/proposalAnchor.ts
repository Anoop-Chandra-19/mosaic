import type { AddPlace, OrderPlace, ProposalChange, TextPlace } from '@shared/types/agentProposal';
import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';

export type AnchorMismatch = 'unknown-target' | 'changed-since-read';

export function findSection(doc: ResumeData, sectionId: string): ResumeSection | undefined {
  return doc.sections.find((section) => section.id === sectionId);
}

export function findEntry(
  doc: ResumeData,
  sectionId: string,
  entryId: string
): ResumeEntry | undefined {
  return findSection(doc, sectionId)?.items.find((entry) => entry.id === entryId);
}

/** The bullet or line a place names, as the draft holds it. */
export function findTextItem(
  doc: ResumeData,
  place: TextPlace
): { text: string; selected: boolean } | undefined {
  if (place.unit === 'line') {
    const line = findEntry(doc, place.sectionId, place.lineId);
    return line && { text: line.text ?? '', selected: line.selected };
  }
  return findEntry(doc, place.sectionId, place.entryId)?.bullets.find(
    (bullet) => bullet.id === place.bulletId
  );
}

/** The ids in a list, in the order they print. */
export function readOrder(doc: ResumeData, place: OrderPlace): string[] | undefined {
  if (place.unit === 'items')
    return findSection(doc, place.sectionId)?.items.map((item) => item.id);
  return findEntry(doc, place.sectionId, place.entryId)?.bullets.map((bullet) => bullet.id);
}

/** The bullets or lines new text goes among, by id; undefined when the place is gone. */
export function readAddedAmong(doc: ResumeData, place: AddPlace): string[] | undefined {
  if (place.unit === 'line') {
    const section = findSection(doc, place.sectionId);
    return section?.layout === 'lines' ? section.items.map((item) => item.id) : undefined;
  }
  return findEntry(doc, place.sectionId, place.entryId)?.bullets.map((bullet) => bullet.id);
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

function compareText(text: string | undefined, before: string): AnchorMismatch | null {
  if (text === undefined) return 'unknown-target';
  return text === before ? null : 'changed-since-read';
}

function findMergeMismatch(
  doc: ResumeData,
  change: Extract<ProposalChange, { kind: 'merge' }>
): AnchorMismatch | null {
  const bullets = findEntry(doc, change.sectionId, change.entryId)?.bullets ?? [];
  const first = bullets.findIndex((bullet) => bullet.id === change.firstId);
  const second = bullets.findIndex((bullet) => bullet.id === change.secondId);
  if (first < 0 || second < 0) return 'unknown-target';
  // Moved apart since: no longer a pair to merge.
  if (second !== first + 1) return 'changed-since-read';
  return sameList([bullets[first].text, bullets[second].text], change.before)
    ? null
    : 'changed-since-read';
}

/**
 * Whether a change still fits the draft: its targets exist and read what they read when it
 * was made. Edits elsewhere in the document don't matter.
 */
export function findAnchorMismatch(doc: ResumeData, change: ProposalChange): AnchorMismatch | null {
  switch (change.kind) {
    case 'rewrite':
      return compareText(findTextItem(doc, change.place)?.text, change.before);
    case 'split': {
      const { sectionId, entryId, bulletId } = change;
      return compareText(
        findTextItem(doc, { unit: 'bullet', sectionId, entryId, bulletId })?.text,
        change.before
      );
    }
    case 'select':
      return compareText(findTextItem(doc, change.place)?.text, change.before);
    case 'merge':
      return findMergeMismatch(doc, change);
    case 'reorder': {
      const ids = readOrder(doc, change.place);
      if (!ids) return 'unknown-target';
      return sameList(ids, change.before) ? null : 'changed-since-read';
    }
    case 'add': {
      const among = readAddedAmong(doc, change.place);
      if (!among) return 'unknown-target';
      return change.afterId === null || among.includes(change.afterId)
        ? null
        : 'changed-since-read';
    }
    case 'entry': {
      const section = findSection(doc, change.sectionId);
      const hasPlace =
        !change.afterEntryId || section?.items.some((entry) => entry.id === change.afterEntryId);
      return section && hasPlace ? null : 'unknown-target';
    }
  }
}

/** The id a text place names: a bullet's, or a line's (its item's). */
export const readTextPlaceId = (place: TextPlace) =>
  place.unit === 'bullet' ? place.bulletId : place.lineId;

/**
 * What a change changes, by id: the bullets and lines that two kept suggestions can't
 * both change.
 */
export function readChangedIds(change: ProposalChange): string[] {
  switch (change.kind) {
    case 'rewrite':
    case 'select':
      return [readTextPlaceId(change.place)];
    case 'split':
      return [change.bulletId];
    case 'merge':
      return [change.firstId, change.secondId];
    case 'reorder':
      return change.after;
    case 'add':
    case 'entry':
      return [];
  }
}

export function isProposalCurrent(doc: ResumeData, change: ProposalChange): boolean {
  return findAnchorMismatch(doc, change) === null;
}
