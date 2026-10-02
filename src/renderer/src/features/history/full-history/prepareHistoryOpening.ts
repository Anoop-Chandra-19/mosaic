import { whenPreviewSettled } from '@/features/view-transitions/pageHandoff';
import { getDb } from '@/lib/storage/mosaicDb';
import type { Version, VersionMeta } from '@shared/types/db';

/** A version's document and the one before it, read together so they land together. */
export interface VersionPair {
  version: Version | null;
  /** Null for the first version. */
  parent: Version | null;
}

export interface PreparedHistory {
  versions: VersionMeta[];
  /** The version the view opens on. */
  opening: VersionPair;
}

/** Reads the version `id` and the one before it in `versions`, newest first. */
export async function readVersionPair(versions: VersionMeta[], id: string): Promise<VersionPair> {
  const db = getDb();
  const index = versions.findIndex((version) => version.id === id);
  const parentMeta = index >= 0 ? versions[index + 1] : undefined;
  const [version, parent] = await Promise.all([
    db.versions.get(id),
    parentMeta ? db.versions.get(parentMeta.id) : null,
  ]);
  return { version, parent };
}

const openings = new WeakMap<object, Promise<PreparedHistory | null>>();

/**
 * The version the view opens on: the one asked for, or else the one before the newest,
 * since the newest holds what the draft already has.
 */
export function chooseOpeningVersion(
  versions: VersionMeta[],
  versionId?: string
): string | undefined {
  if (versionId && versions.some((version) => version.id === versionId)) return versionId;
  return (versions[1] ?? versions[0])?.id;
}

/**
 * What the history view first shows, loaded before it opens, so it opens with its page
 * drawn and the preview's page can move into it, once the preview has eased to fit. One
 * promise per opening, keyed by the surface object, as `use()` needs. On failure the view
 * loads as it would have anyway.
 */
export function prepareHistoryOpening(
  opening: object,
  templateId: string,
  versionId?: string
): Promise<PreparedHistory | null> {
  let prepared = openings.get(opening);
  if (!prepared) {
    const settled = whenPreviewSettled();
    prepared = (async () => {
      const versions = await getDb().versions.list(templateId);
      const id = chooseOpeningVersion(versions, versionId);
      const opening = id ? await readVersionPair(versions, id) : { version: null, parent: null };
      await settled;
      return { versions, opening };
    })().catch((error: unknown) => {
      console.error('Could not load the history ahead of opening it', error);
      return null;
    });
    openings.set(opening, prepared);
  }
  return prepared;
}
