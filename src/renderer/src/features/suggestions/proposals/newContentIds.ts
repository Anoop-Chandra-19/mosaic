import type {
  EntryDraft,
  NewEntryIds,
  NewContentIds,
  ProposalChange,
  SectionContents,
} from '@/types/agentProposal';

/*
 * Stable ids for proposed additions. Staging calls createNewContentIds; apply uses those
 * ids in the draft, and listNewContentIds lists them for checking which additions survived.
 */

const createEntryIds = ({ bullets }: EntryDraft, createId: () => string): NewEntryIds => ({
  entryId: createId(),
  bulletIds: bullets.map(createId),
});

type SectionContentIds = Extract<NewContentIds, { kind: 'section' }>['contents'];

function createSectionContentIds(
  contents: SectionContents | null,
  createId: () => string
): SectionContentIds {
  if (contents === null) return null;
  return contents.layout === 'entries'
    ? { layout: 'entries', entry: createEntryIds(contents.entry, createId) }
    : { layout: 'lines', lineIds: contents.lines.map(createId) };
}

/** Create ids for the new things a change adds. Returns null when it adds none. */
export function createNewContentIds(
  change: ProposalChange,
  createId: () => string = () => crypto.randomUUID()
): NewContentIds | null {
  switch (change.kind) {
    case 'split':
      return { kind: 'split', secondBulletId: createId() };
    case 'add':
      return { kind: 'add', id: createId() };
    case 'entry':
      return { kind: 'entry', entry: createEntryIds(change, createId) };
    case 'section': {
      const sectionId = createId();
      return {
        kind: 'section',
        sectionId,
        contents: createSectionContentIds(change.contents, createId),
      };
    }
    default:
      return null;
  }
}

const listEntryIds = ({ entryId, bulletIds }: NewEntryIds) => [entryId, ...bulletIds];

/**
 * List the ids, parent first: a section before its lines or entry, an entry before its
 * bullets. Ids for empty bullets and lines are included, though apply skips those.
 */
export function listNewContentIds(ids: NewContentIds | null): string[] {
  switch (ids?.kind) {
    case undefined:
      return [];
    case 'split':
      return [ids.secondBulletId];
    case 'add':
      return [ids.id];
    case 'entry':
      return listEntryIds(ids.entry);
    case 'section': {
      const { sectionId, contents } = ids;
      if (contents === null) return [sectionId];
      return [
        sectionId,
        ...(contents.layout === 'entries' ? listEntryIds(contents.entry) : contents.lineIds),
      ];
    }
  }
}
