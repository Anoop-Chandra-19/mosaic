import type {
  EntryDraft,
  Proposal,
  ProposalChange,
  ProposalChangeKind,
  ShowPlace,
  TextPlace,
} from '@/types/agentProposal';
import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { findAnchorMismatch, findEntry, findSection } from '../proposalAnchor';

/**
 * Hiding goes first, since it keys on text a rewrite would change; text before structure;
 * added text after the orders it would otherwise upset; new entries and sections last. A
 * change that no longer fits once the ones before it have landed (two rewrites of one
 * bullet, a merge of bullets a reorder moved apart) is skipped, not forced.
 */
const APPLY_ORDER: Record<ProposalChangeKind, number> = {
  select: 0,
  rewrite: 1,
  rename: 1,
  split: 2,
  merge: 3,
  reorder: 4,
  add: 5,
  entry: 6,
  section: 7,
};

/** In the order they apply, which is not the order they were suggested in. */
export function sortForApply<T extends Pick<Proposal, 'change'>>(proposals: readonly T[]): T[] {
  return [...proposals].sort((a, b) => APPLY_ORDER[a.change.kind] - APPLY_ORDER[b.change.kind]);
}

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

/** The place's own record: a bullet, or a line's item. */
function findTextRecord(doc: ResumeData, place: TextPlace) {
  if (place.unit === 'line') return findEntry(doc, place.sectionId, place.lineId)!;
  return findEntry(doc, place.sectionId, place.entryId)!.bullets.find(
    (bullet) => bullet.id === place.bulletId
  )!;
}

function placeBullet(doc: ResumeData, sectionId: string, entryId: string, bulletId: string) {
  const entry = findEntry(doc, sectionId, entryId)!;
  const index = entry.bullets.findIndex((bullet) => bullet.id === bulletId);
  return { bullets: entry.bullets, index, bullet: entry.bullets[index] };
}

/** A section shows by `hidden`, everything else by `selected`. */
function setShown(doc: ResumeData, place: ShowPlace, isShown: boolean) {
  if (place.unit === 'section') {
    const section = findSection(doc, place.sectionId)!;
    if (isShown) delete section.hidden;
    else section.hidden = true;
    return;
  }
  const record =
    place.unit === 'entry'
      ? findEntry(doc, place.sectionId, place.entryId)!
      : findTextRecord(doc, place);
  record.selected = isShown;
}

/** Where new items go in a list: right after `afterId`, or first when it is null. */
const insertAt = (ids: string[], afterId: string | null) =>
  afterId === null ? 0 : ids.indexOf(afterId) + 1;

function addText(
  doc: ResumeData,
  change: Extract<ProposalChange, { kind: 'add' }>,
  createId: () => string
) {
  const text = change.text.trim();
  const { place } = change;
  if (place.unit === 'line') {
    const items = findSection(doc, place.sectionId)!.items;
    const at = insertAt(
      items.map((item) => item.id),
      change.afterId
    );
    items.splice(at, 0, { id: createId(), selected: true, bullets: [], text });
    return;
  }
  const bullets = findEntry(doc, place.sectionId, place.entryId)!.bullets;
  const at = insertAt(
    bullets.map((bullet) => bullet.id),
    change.afterId
  );
  bullets.splice(at, 0, { id: createId(), text, selected: true });
}

/** A new entry from a suggestion: its facts as written, its non-empty bullets. */
function createEntry({ frame, bullets }: EntryDraft, createId: () => string): ResumeEntry {
  return {
    id: createId(),
    selected: true,
    ...frame,
    bullets: bullets
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ id: createId(), text, selected: true })),
  };
}

function addSection(
  doc: ResumeData,
  change: Extract<ProposalChange, { kind: 'section' }>,
  createId: () => string
) {
  const { contents } = change;
  const sectionId = createId();
  const items =
    contents.layout === 'lines'
      ? contents.lines
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({ id: createId(), selected: true, bullets: [], text }))
      : [createEntry(contents.entry, createId)];
  const section: ResumeSection = { id: sectionId, ...change.section, items, order: 0 };
  const ordered = [...doc.sections].sort((a, b) => a.order - b.order);
  ordered.splice(
    insertAt(
      ordered.map((each) => each.id),
      change.afterSectionId
    ),
    0,
    section
  );
  ordered.forEach((each, order) => (each.order = order));
  doc.sections = ordered;
}

function reorder(doc: ResumeData, change: Extract<ProposalChange, { kind: 'reorder' }>) {
  const { place, after } = change;
  if (place.unit === 'sections') {
    doc.sections = reorderById(doc.sections, after);
    doc.sections.forEach((section) => (section.order = after.indexOf(section.id)));
    return;
  }
  const section = findSection(doc, place.sectionId)!;
  if (place.unit === 'items') {
    section.items = reorderById(section.items, after);
    return;
  }
  const entry = section.items.find((item) => item.id === place.entryId)!;
  entry.bullets = reorderById(entry.bullets, after);
}

/** Changes `doc` in place; the change has been checked to fit it. */
function applyChange(doc: ResumeData, change: ProposalChange, createId: () => string): void {
  switch (change.kind) {
    case 'select':
      setShown(doc, change.place, change.selected);
      return;
    case 'rewrite':
      findTextRecord(doc, change.place).text = change.after.trim();
      return;
    case 'rename':
      findSection(doc, change.sectionId)!.label = change.after.trim();
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
    case 'reorder':
      reorder(doc, change);
      return;
    case 'add':
      addText(doc, change, createId);
      return;
    case 'entry': {
      const section = findSection(doc, change.sectionId)!;
      const at = change.afterEntryId
        ? section.items.findIndex((item) => item.id === change.afterEntryId) + 1
        : 0;
      section.items.splice(at, 0, createEntry(change, createId));
      return;
    }
    case 'section':
      addSection(doc, change, createId);
      return;
  }
}

/** The document with these proposals applied, on a copy; the input is left as it was. */
export function applyProposalsToResume(
  doc: ResumeData,
  proposals: readonly Proposal[],
  createId: () => string = () => crypto.randomUUID()
): AppliedProposals {
  const result: AppliedProposals = { doc: structuredClone(doc), appliedIds: [], skippedIds: [] };
  for (const proposal of sortForApply(proposals)) {
    if (findAnchorMismatch(result.doc, proposal.change)) {
      result.skippedIds.push(proposal.id);
      continue;
    }
    applyChange(result.doc, proposal.change, createId);
    result.appliedIds.push(proposal.id);
  }
  return result;
}
