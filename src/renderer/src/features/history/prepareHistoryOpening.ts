import { waitForPreviewToFit } from '@/features/preview/useFitPreviewUnderSurface';
import { getDb } from '@/lib/storage/mosaicDb';
import type { VersionMeta } from '@shared/types/db';
import { loadVersion } from './versionCache';

export interface PreparedHistory {
  versions: VersionMeta[];
}

const openings = new WeakMap<object, Promise<PreparedHistory | null>>();

/**
 * What the history view first shows, loaded before it opens (the version it opens on goes
 * into the version cache), so it opens with its page drawn and the preview's page can move
 * into it, once the preview has eased to fit. One promise per opening, keyed by the
 * surface object, as `use()` needs. On failure the view loads as it would have anyway.
 */
export function prepareHistoryOpening(
  opening: object,
  templateId: string,
  versionId?: string
): Promise<PreparedHistory | null> {
  let prepared = openings.get(opening);
  if (!prepared) {
    const settled = waitForPreviewToFit();
    prepared = (async () => {
      const versions = await getDb().versions.list(templateId);
      const id = versions.some((v) => v.id === versionId) ? versionId : versions[0]?.id;
      if (id) await loadVersion(id);
      await settled;
      return { versions };
    })().catch((error: unknown) => {
      console.error('Could not load the history ahead of opening it', error);
      return null;
    });
    openings.set(opening, prepared);
  }
  return prepared;
}
