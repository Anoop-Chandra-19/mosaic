import { whenPreviewSettled } from '@/features/view-transitions/pageHandoff';
import { getDb } from '@/lib/storage/mosaicDb';
import type { Version, VersionMeta } from '@shared/types/db';

export interface PreparedHistory {
  versions: VersionMeta[];
  /** The version the view opens on. */
  version: Version | null;
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
      const db = getDb();
      const versions = await db.versions.list(templateId);
      const id = chooseOpeningVersion(versions, versionId);
      const version = id ? await db.versions.get(id) : null;
      await settled;
      return { versions, version };
    })().catch((error: unknown) => {
      console.error('Could not load the history ahead of opening it', error);
      return null;
    });
    openings.set(opening, prepared);
  }
  return prepared;
}
