import type { VersionMeta } from '@shared/types/db';

/**
 * "v3": its place in the history when it was taken; "v3.1" for the first revision added to
 * it. Deleting another never changes it.
 */
export function versionLabel(version: VersionMeta): string {
  return version.revision ? `v${version.number}.${version.revision}` : `v${version.number}`;
}
