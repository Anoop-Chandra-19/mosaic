import type { EntryDraft, NewEntryIds, NewContentIds, ProposalChange } from '@/types/agentProposal';

/*
 * Stable ids for proposed additions. Staging calls createNewContentIds; apply uses those
 * ids in the draft, and listNewContentIds lists them for checking which additions survived.
 */

const createEntryIds = ({ bullets }: EntryDraft, createId: () => string): NewEntryIds => ({
  entryId: createId(),
  bulletIds: bullets.map(createId),
});

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
      const contents =
        change.contents.layout === 'entries'
          ? { layout: 'entries' as const, entry: createEntryIds(change.contents.entry, createId) }
          : { layout: 'lines' as const, lineIds: change.contents.lines.map(createId) };
      return { kind: 'section', sectionId, contents };
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
    case 'section':
      return [
        ids.sectionId,
        ...(ids.contents.layout === 'entries'
          ? listEntryIds(ids.contents.entry)
          : ids.contents.lineIds),
      ];
  }
}
