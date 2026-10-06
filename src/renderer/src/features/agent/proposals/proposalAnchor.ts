import type { ProposalChange } from '@shared/types/agentProposal';
import type { Bullet, ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';

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

function findBullet(
  doc: ResumeData,
  sectionId: string,
  entryId: string,
  bulletId: string
): Bullet | undefined {
  return findEntry(doc, sectionId, entryId)?.bullets.find((bullet) => bullet.id === bulletId);
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

function compareBulletText(bullet: Bullet | undefined, before: string): AnchorMismatch | null {
  if (!bullet) return 'unknown-target';
  return bullet.text === before ? null : 'changed-since-read';
}

/**
 * Whether a change still fits the draft: its targets exist and read what they read when it
 * was made. Edits elsewhere in the document don't matter.
 */
export function findAnchorMismatch(doc: ResumeData, change: ProposalChange): AnchorMismatch | null {
  switch (change.kind) {
    case 'rewrite':
    case 'split':
    case 'select':
      return compareBulletText(
        findBullet(doc, change.sectionId, change.entryId, change.bulletId),
        change.before
      );
    case 'merge': {
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
    case 'reorder': {
      const section = findSection(doc, change.sectionId);
      const ids = change.entryId
        ? section?.items.find((entry) => entry.id === change.entryId)?.bullets.map((b) => b.id)
        : section?.items.map((entry) => entry.id);
      if (!ids) return 'unknown-target';
      return sameList(ids, change.before) ? null : 'changed-since-read';
    }
    case 'entry': {
      const section = findSection(doc, change.sectionId);
      const hasPlace =
        !change.afterEntryId || section?.items.some((entry) => entry.id === change.afterEntryId);
      return section && hasPlace ? null : 'unknown-target';
    }
  }
}

export function isProposalCurrent(doc: ResumeData, change: ProposalChange): boolean {
  return findAnchorMismatch(doc, change) === null;
}
