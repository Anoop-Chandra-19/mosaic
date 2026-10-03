import { useEffect, useState } from 'react';
import { getDb } from '@/lib/storage/mosaicDb';
import { useTemplateStore } from '@/stores/templateStore';
import type { TemplateSummary, VersionMeta } from '@shared/types/db';

/** "v3": its place in the history when it was taken. Deleting another never changes it. */
export function versionLabel(version: VersionMeta): string {
  return `v${version.number}`;
}

/**
 * A template's history, newest first, loaded while its card is expanded. It reloads when
 * the summary shows the history changed (a new version, or the newest one renamed), or
 * after any rename or delete.
 */
export function useTemplateVersions(
  template: TemplateSummary,
  enabled: boolean,
  initial: VersionMeta[] | null = null
): VersionMeta[] | null {
  const [versions, setVersions] = useState<VersionMeta[] | null>(initial);
  const { id, versionCount, head } = template;
  const historyEdits = useTemplateStore((s) => s.historyEdits);
  const changed = `${versionCount}:${head.id}:${head.kind}:${head.summary}:${head.rev}:${historyEdits}`;

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
