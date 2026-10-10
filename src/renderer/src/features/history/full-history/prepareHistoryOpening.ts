import { whenPreviewSettled } from '@/features/view-transitions/pageHandoff';
import { getDb } from '@/lib/storage/mosaicDb';
import type { HistoryComparison } from '@/types/history';
import type { Version, VersionMeta } from '@shared/types/db';

/** A version's document and the one it is compared with, read together so they land together. */
export interface VersionPair {
  version: Version | null;
  /** Null for the first version. */
  base: Version | null;
}

export interface PreparedHistory {
  versions: VersionMeta[];
  /** The version the view opens on. */
  opening: VersionPair;
}

/** Whether the version at `index` belongs to a number with more than one revision. */
export function hasRevisions(versions: VersionMeta[], index: number): boolean {
  const number = versions[index]?.number;
  return versions[index - 1]?.number === number || versions[index + 1]?.number === number;
}

/** The comparison to show: "All of v11" stays picked, and reads as the version before for one with no revisions. */
export function resolveComparison(
  picked: HistoryComparison,
  versions: VersionMeta[],
  index: number
): HistoryComparison {
  return picked === 'number' && !hasRevisions(versions, index) ? 'parent' : picked;
}

/**
 * The version the one at `index` is compared with, in `versions`, newest first: the one
 * before it, or for `number`, the one before its number's first revision. Against the
 * draft, the one before it still says whether there is anything to compare with.
 */
export function findComparedBase(
  versions: VersionMeta[],
  index: number,
  comparison: HistoryComparison
): VersionMeta | null {
  if (index < 0) return null;
  let oldest = index;
  if (comparison === 'number') {
    while (versions[oldest + 1]?.number === versions[index].number) oldest += 1;
  }
  return versions[oldest + 1] ?? null;
}

/** How the view reads a version's document: from the database, or the example's memory. */
export type VersionReader = (id: string) => Promise<Version>;

export const readStoredVersion: VersionReader = (id) => getDb().versions.get(id);

/** Reads the version `id` and the one it is compared with. */
export async function readVersionPair(
  versions: VersionMeta[],
  id: string,
  comparison: HistoryComparison = 'parent',
  readVersion: VersionReader = readStoredVersion
): Promise<VersionPair> {
  const index = versions.findIndex((version) => version.id === id);
  const baseMeta = findComparedBase(versions, index, comparison);
  const [version, base] = await Promise.all([
    readVersion(id),
    baseMeta ? readVersion(baseMeta.id) : null,
  ]);
  return { version, base };
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
      const opening = id ? await readVersionPair(versions, id) : { version: null, base: null };
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
