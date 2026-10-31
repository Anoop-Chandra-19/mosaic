import { useResumeStore } from '@/stores/resumeStore';
import { useStoredDraft } from '@/stores/templateStore';
import type { HistoryComparison } from '@/types/history';
import { diffFormatting } from '@/lib/resume/changes/diffFormatting';
import { diffResumes } from '@/lib/resume/changes/diffResumes';
import type { Version, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';

/**
 * The draft a version is compared with: the editor's, as typed, for the open template;
 * the stored one for any other, read without opening it.
 */
function useComparedDraft(templateId: string, fixedDraft: ResumeData | null) {
  const isOpen = useResumeStore((s) => s.templateId === templateId);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const stored = useStoredDraft(isOpen || fixedDraft ? null : templateId);

  if (fixedDraft) return fixedDraft;
  if (isOpen) return { schemaVersion, contact, sections };
  return stored?.doc ?? null;
}

function compareResumes(before: ResumeData | null, after: ResumeData | null) {
  if (!before || !after) return null;
  return { diff: diffResumes(before, after), formatting: diffFormatting(before, after) };
}

interface ComparedVersion {
  templateId: string;
  /** The draft to compare with instead of the template's, as the example history has. */
  fixedDraft: ResumeData | null;
  /** The version's document, once read. */
  version: Version | null;
  /** What it is compared with unless that is the draft: the version before it, or its number's. */
  base: VersionMeta | null;
  /** Its document, once read. */
  baseVersion: Version | null;
  baseLabel: string;
  /** Picked, and possible for this version: `number` only for one with revisions. */
  comparison: HistoryComparison;
  /** The first version has nothing before it. */
  hasParent: boolean;
}

export type VersionComparison = ReturnType<typeof useVersionComparison>;

/**
 * A version against the one before it, against everything its number did, or against
 * the draft, as picked; the first version has nothing before it, so it is read against
 * the draft. How far it is from the draft is worked out either way, for Restore.
 */
export function useVersionComparison({
  templateId,
  fixedDraft,
  version,
  base: baseMeta,
  baseVersion,
  baseLabel,
  comparison,
  hasParent,
}: ComparedVersion) {
  const draft = useComparedDraft(templateId, fixedDraft);
  const isAgainstDraft = comparison === 'draft' || !baseMeta;
  const versionDoc = version?.doc ?? null;
  const base = isAgainstDraft ? draft : (baseVersion?.doc ?? null);
  const againstDraft = compareResumes(draft, versionDoc);
  const shown = isAgainstDraft ? againstDraft : compareResumes(base, versionDoc);
  return {
    /** What the version is compared with, as a resume; null until read. */
    base,
    diff: shown?.diff ?? null,
    formatting: shown?.formatting ?? [],
    comparedWith: isAgainstDraft ? ('draft' as const) : comparison,
    isAgainstDraft,
    canCompareWithParent: hasParent,
    otherSide: isAgainstDraft ? 'your draft' : baseLabel,
    /** How many changes stand between the version and the draft; null until both are read. */
    draftChangeCount: againstDraft?.diff.changes.length ?? null,
    hasDraftFormatting: (againstDraft?.formatting.length ?? 0) > 0,
  };
}
