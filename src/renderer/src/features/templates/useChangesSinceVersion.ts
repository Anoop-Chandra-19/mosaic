import { useEffect, useState } from 'react';
import { versionLabel } from '@/features/history/useTemplateVersions';
import { getDb } from '@/lib/storage/mosaicDb';
import { useResumeStore } from '@/stores/resumeStore';
import { describeChange, describeFormattingChange } from '@shared/resume/changes/describeChanges';
import { diffFormatting } from '@shared/resume/changes/diffFormatting';
import { diffResumes } from '@shared/resume/changes/diffResumes';
import { getChangeGroup, type Change } from '@shared/resume/changes/resumeChange';
import type { VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';

export interface NamingChangeRow {
  key: string;
  text: string;
  /** Where on the page, when the text doesn't already say it. */
  place: string | null;
}

export interface ChangesSinceVersion {
  /** Counted, in page order. */
  changes: NamingChangeRow[];
  /** Last and uncounted, as in the full history. */
  formatting: NamingChangeRow[];
}

/** The change's group, less a last step the noun already names ("Projects › Loom cards"). */
function placeChange(change: Change, noun: string): string | null {
  const steps = getChangeGroup(change).split(' › ');
  if (steps.at(-1) === noun) steps.pop();
  return steps.length > 0 ? steps.join(' › ') : null;
}

function describeChangeRow(change: Change): NamingChangeRow {
  const { noun, verb } = describeChange(change);
  return { key: change.id, text: `${noun} ${verb}`, place: placeChange(change, noun) };
}

/**
 * The draft's changes since a version, in the full history's words. Undone work is listed
 * as what the version has and the draft no longer does, so each row names the work undone.
 */
export function listChangesSinceVersion(
  version: ResumeData,
  draft: ResumeData,
  label: string,
  isUndone: boolean
): ChangesSinceVersion {
  const diff = isUndone ? diffResumes(draft, version) : diffResumes(version, draft);
  return {
    changes: diff.changes.map(describeChangeRow),
    formatting: diffFormatting(version, draft).map((change) => ({
      key: `${change.setting}:${change.lineId}`,
      text: describeFormattingChange(change, label).row,
      place: null,
    })),
  };
}

/** The draft's changes since `version`; null until the version's document is read. */
export function useChangesSinceVersion(
  version: VersionMeta | undefined,
  isUndone: boolean
): ChangesSinceVersion | null {
  const [read, setRead] = useState<{ id: string; doc: ResumeData } | null>(null);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const versionId = version?.id;

  useEffect(() => {
    if (!versionId) return;
    let isCurrent = true;
    getDb()
      .versions.get(versionId)
      .then(
        (stored) => isCurrent && setRead({ id: versionId, doc: stored.doc }),
        (error: unknown) => console.error('Could not read the newest version', error)
      );
    return () => {
      isCurrent = false;
    };
  }, [versionId]);

  if (!version || read?.id !== version.id) return null;
  const draft = { schemaVersion, contact, sections };
  return listChangesSinceVersion(read.doc, draft, versionLabel(version), isUndone);
}
