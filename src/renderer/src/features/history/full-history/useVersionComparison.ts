import { useEffect, useState } from 'react';
import { getDb } from '@/lib/storage/mosaicDb';
import { useResumeStore } from '@/stores/resumeStore';
import type { HistoryComparison } from '@/types/history';
import { diffFormatting } from '@shared/resume/changes/diffFormatting';
import { diffResumes } from '@shared/resume/changes/diffResumes';
import type { Draft, Version, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';

/**
 * The draft a version is compared with: the editor's, as typed, for the open template;
 * the stored one for any other, read without opening it.
 */
function useComparedDraft(templateId: string) {
  const isOpen = useResumeStore((s) => s.templateId === templateId);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const [stored, setStored] = useState<Draft | null>(null);

  useEffect(() => {
    if (isOpen) return;
    let isCurrent = true;
    getDb()
      .drafts.get(templateId)
      .then(
        (draft) => isCurrent && setStored(draft),
        (error: unknown) => console.error('Could not read the draft', error)
      );
    return () => {
      isCurrent = false;
    };
  }, [templateId, isOpen]);

  if (isOpen) return { schemaVersion, contact, sections };
  return stored?.templateId === templateId ? stored.doc : null;
}

function compareResumes(before: ResumeData | null, after: ResumeData | null) {
  if (!before || !after) return null;
  return { diff: diffResumes(before, after), formatting: diffFormatting(before, after) };
}

interface ComparedVersion {
  templateId: string;
  /** The version's document, once read. */
  version: Version | null;
  /** The version before it; null for the first. */
  parent: VersionMeta | null;
  /** Its document, once read. */
  parentVersion: Version | null;
  parentLabel: string;
  comparison: HistoryComparison;
}

/**
 * A version against the one before it, or against the draft, as picked; the first
 * version has nothing before it, so it is read against the draft. How far it is from the
 * draft is worked out either way, for Restore.
 */
export function useVersionComparison({
  templateId,
  version,
  parent,
  parentVersion,
  parentLabel,
  comparison,
}: ComparedVersion) {
  const draft = useComparedDraft(templateId);
  const isAgainstDraft = comparison === 'draft' || !parent;
  const versionDoc = version?.doc ?? null;
  const base = isAgainstDraft ? draft : (parentVersion?.doc ?? null);
  const againstDraft = compareResumes(draft, versionDoc);
  const shown = isAgainstDraft ? againstDraft : compareResumes(base, versionDoc);
  return {
    /** What the version is compared with, as a resume; null until read. */
    base,
    diff: shown?.diff ?? null,
    formatting: shown?.formatting ?? [],
    isAgainstDraft,
    canCompareWithParent: parent !== null,
    otherSide: isAgainstDraft ? 'your draft' : parentLabel,
    /** How many changes stand between the version and the draft; null until both are read. */
    draftChangeCount: againstDraft?.diff.changes.length ?? null,
    hasDraftFormatting: (againstDraft?.formatting.length ?? 0) > 0,
  };
}
