import { useEffect, useState } from 'react';
import { getDb } from '@/lib/storage/mosaicDb';
import type { TemplateSummary, VersionMeta } from '@shared/types/db';

/** "v3": a version's place in its template's history, counted from the oldest. */
export function versionLabel(versions: VersionMeta[], index: number): string {
  return `v${versions.length - index}`;
}

/**
 * A template's history, newest first, loaded while its card is expanded. It reloads when
 * the summary shows the history changed — a new version, or the newest one renamed.
 */
export function useTemplateVersions(
  template: TemplateSummary,
  enabled: boolean,
  initial: VersionMeta[] | null = null
): VersionMeta[] | null {
  const [versions, setVersions] = useState<VersionMeta[] | null>(initial);
  const { id, versionCount, head } = template;
  const changed = `${versionCount}:${head.id}:${head.kind}:${head.summary}:${head.rev}`;

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    getDb()
      .versions.list(id)
      .then(
        (list) => current && setVersions(list),
        (error: unknown) => console.error('Could not load the history', error)
      );
    return () => {
      current = false;
    };
  }, [id, changed, enabled]);

  return versions;
}
