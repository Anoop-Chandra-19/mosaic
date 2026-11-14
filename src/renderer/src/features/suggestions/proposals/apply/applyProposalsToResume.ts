import { findAnchorMismatch, findEntry, findSection } from '@/lib/resume/proposalAnchor';
import type {
  EntryDraft,
  NewEntryIds,
  NewContentIds,
  Proposal,
  ProposalChange,
  ShowPlace,
  TextPlace,
} from '@/types/agentProposal';
import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';

export interface AppliedProposals {
  doc: ResumeData;
  appliedIds: string[];
  /** Proposals that were not applied because they no longer fit the document. */
  skippedIds: string[];
}

function reorderById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)!);
}

/** Find the record that holds a place's text: the bullet, or the item of a line. */
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

/** Show or hide a place. A section stores this in `hidden`; everything else stores it in `selected`. */
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

/** Return the index for a new item: right after `afterId`, or 0 when `afterId` is null. */
const insertAt = (ids: string[], afterId: string | null) =>
  afterId === null ? 0 : ids.indexOf(afterId) + 1;

/** Return the ids for a change of this kind. Staging always sets them, so a mismatch is a bug. */
function expectNewContentIds<K extends NewContentIds['kind']>(
  ids: NewContentIds | null,
  kind: K
): Extract<NewContentIds, { kind: K }> {
  if (ids?.kind !== kind) {
    throw new Error(`Expected new content IDs for "${kind}", received "${ids?.kind ?? 'none'}"`);
  }
  return ids as Extract<NewContentIds, { kind: K }>;
}

function addText(doc: ResumeData, change: Extract<ProposalChange, { kind: 'add' }>, id: string) {
  const text = change.text.trim();
  const { place } = change;
  if (place.unit === 'line') {
    const items = findSection(doc, place.sectionId)!.items;
    const at = insertAt(
      items.map((item) => item.id),
      change.afterId
    );
    items.splice(at, 0, { id, selected: true, bullets: [], text });
    return;
  }
  const bullets = findEntry(doc, place.sectionId, place.entryId)!.bullets;
  const at = insertAt(
    bullets.map((bullet) => bullet.id),
    change.afterId
  );
  bullets.splice(at, 0, { id, text, selected: true });
}

/** Build a new entry from a suggestion, with its facts as written and its non-empty bullets. */
function createEntry({ frame, bullets }: EntryDraft, ids: NewEntryIds): ResumeEntry {
  return {
    id: ids.entryId,
    selected: true,
    ...frame,
    bullets: bullets
      .map((text, index) => ({ id: ids.bulletIds[index], text: text.trim(), selected: true }))
      .filter((bullet) => bullet.text),
  };
}

/** Build a new section's items: its non-empty lines, or its first entry. */
function createSectionItems(
  contents: Extract<ProposalChange, { kind: 'section' }>['contents'],
  ids: Extract<NewContentIds, { kind: 'section' }>['contents']
): ResumeEntry[] {
  if (contents.layout === 'lines' && ids.layout === 'lines') {
    return contents.lines
      .map((text, index) => ({
        id: ids.lineIds[index],
        selected: true,
        bullets: [],
        text: text.trim(),
      }))
      .filter((line) => line.text);
  }
  if (contents.layout === 'entries' && ids.layout === 'entries') {
    return [createEntry(contents.entry, ids.entry)];
  }
  throw new Error(
    `Expected new content IDs for section layout "${contents.layout}", received "${ids.layout}"`
  );
}

function addSection(
  doc: ResumeData,
  change: Extract<ProposalChange, { kind: 'section' }>,
  ids: Extract<NewContentIds, { kind: 'section' }>
) {
  const items = createSectionItems(change.contents, ids.contents);
  const section: ResumeSection = { id: ids.sectionId, ...change.section, items, order: 0 };
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

/** Apply one change to `doc` in place. The caller has already checked that the change fits. */
function applyChange(doc: ResumeData, change: ProposalChange, ids: NewContentIds | null): void {
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
      const { secondBulletId } = expectNewContentIds(ids, 'split');
      bullets.splice(index + 1, 0, { id: secondBulletId, text: rest, selected: bullet.selected });
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
      addText(doc, change, expectNewContentIds(ids, 'add').id);
      return;
    case 'entry': {
      const section = findSection(doc, change.sectionId)!;
      const at = change.afterEntryId
        ? section.items.findIndex((item) => item.id === change.afterEntryId) + 1
        : 0;
      section.items.splice(at, 0, createEntry(change, expectNewContentIds(ids, 'entry').entry));
      return;
    }
    case 'section':
      addSection(doc, change, expectNewContentIds(ids, 'section'));
      return;
  }
}

/**
 * Apply the proposals to a copy of the document, in the order given. The input document
 * is not changed. Each proposal is checked against the copy after the earlier proposals
 * were applied. A proposal that no longer fits is skipped, for example a rewrite of text
 * that an earlier proposal already changed.
 */
export function applyProposalsToResume(
  doc: ResumeData,
  proposals: readonly Proposal[]
): AppliedProposals {
  const result: AppliedProposals = { doc: structuredClone(doc), appliedIds: [], skippedIds: [] };
  for (const proposal of proposals) {
    if (findAnchorMismatch(result.doc, proposal.change)) {
      result.skippedIds.push(proposal.id);
      continue;
    }
    applyChange(result.doc, proposal.change, proposal.newContentIds);
    result.appliedIds.push(proposal.id);
  }
  return result;
}
