import type { Proposal, ProposalChange, ProposalChangeKind } from '@shared/types/agent';
import type { ResumeData } from '@shared/types/resume';
import { findAnchorMismatch, findEntry, findSection } from './proposalAnchor';

/**
 * Hiding goes first, since it keys on text a rewrite would change; text before structure,
 * new entries last. A change that no longer fits once the ones before it have landed (two
 * rewrites of one bullet, a merge of bullets a reorder moved apart) is skipped, not forced.
 */
const APPLY_ORDER: Record<ProposalChangeKind, number> = {
  select: 0,
  rewrite: 1,
  split: 2,
  merge: 3,
  reorder: 4,
  entry: 5,
};

export interface AppliedProposals {
  doc: ResumeData;
  appliedIds: string[];
  /** Accepted, but no longer fitting the document by the time their turn came. */
  skippedIds: string[];
}

function reorderById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)!);
}

function placeBullet(doc: ResumeData, sectionId: string, entryId: string, bulletId: string) {
  const entry = findEntry(doc, sectionId, entryId)!;
  const index = entry.bullets.findIndex((bullet) => bullet.id === bulletId);
  return { bullets: entry.bullets, index, bullet: entry.bullets[index] };
}

/** Changes `doc` in place; the change has been checked to fit it. */
function applyChange(doc: ResumeData, change: ProposalChange, createId: () => string): void {
  switch (change.kind) {
    case 'select':
      placeBullet(doc, change.sectionId, change.entryId, change.bulletId).bullet.selected =
        change.selected;
      return;
    case 'rewrite':
      placeBullet(doc, change.sectionId, change.entryId, change.bulletId).bullet.text =
        change.after.trim();
      return;
    case 'split': {
      const { bullets, index, bullet } = placeBullet(
        doc,
        change.sectionId,
        change.entryId,
        change.bulletId
      );
      bullet.text = change.before.slice(0, change.at).trim();
      const rest = change.before.slice(change.at).trim();
      bullets.splice(index + 1, 0, { id: createId(), text: rest, selected: bullet.selected });
      return;
    }
    case 'merge': {
      const { bullets, index, bullet } = placeBullet(
        doc,
        change.sectionId,
        change.entryId,
        change.firstId
      );
      bullet.text = change.after.trim();
      bullets.splice(index + 1, 1);
      return;
    }
    case 'reorder': {
      const section = findSection(doc, change.sectionId)!;
      if (change.entryId) {
        const entry = section.items.find((item) => item.id === change.entryId)!;
        entry.bullets = reorderById(entry.bullets, change.after);
      } else {
        section.items = reorderById(section.items, change.after);
      }
      return;
    }
    case 'entry': {
      const section = findSection(doc, change.sectionId)!;
      const at = change.afterEntryId
        ? section.items.findIndex((item) => item.id === change.afterEntryId) + 1
        : 0;
      section.items.splice(at, 0, {
        id: createId(),
        selected: true,
        ...change.frame,
        bullets: change.bullets
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({ id: createId(), text, selected: true })),
      });
      return;
    }
  }
}

/** The document with these proposals applied, on a copy; the input is left as it was. */
export function applyProposalsToResume(
  doc: ResumeData,
  proposals: readonly Proposal[],
  createId: () => string = () => crypto.randomUUID()
): AppliedProposals {
  const result: AppliedProposals = { doc: structuredClone(doc), appliedIds: [], skippedIds: [] };
  const ordered = [...proposals].sort(
    (a, b) => APPLY_ORDER[a.change.kind] - APPLY_ORDER[b.change.kind]
  );
  for (const proposal of ordered) {
    if (findAnchorMismatch(result.doc, proposal.change)) {
      result.skippedIds.push(proposal.id);
      continue;
    }
    applyChange(result.doc, proposal.change, createId);
    result.appliedIds.push(proposal.id);
  }
  return result;
}
