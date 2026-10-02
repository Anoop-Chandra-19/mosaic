import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { diffFormatting } from '@shared/resume/changes/diffFormatting';
import { diffResumes } from '@shared/resume/changes/diffResumes';

/** The version being read in the sheet against the draft, as typed; null while none is. */
export function useVersionPreviewComparison() {
  const preview = useOverlayStore((s) => s.preview);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  if (!preview) return null;
  const draft = { schemaVersion, contact, sections };
  const versionDoc = preview.version.doc;
  return {
    preview,
    draft,
    diff: diffResumes(draft, versionDoc),
    formatting: diffFormatting(draft, versionDoc),
  };
}

export type VersionPreviewComparison = NonNullable<ReturnType<typeof useVersionPreviewComparison>>;
