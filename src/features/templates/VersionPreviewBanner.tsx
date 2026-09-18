import { useMemo } from 'react';
import { Eye, History } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { attempt, showToast, useOverlayStore, type VersionPreview } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { countChangedLines } from './versionDiff';

/**
 * Over the sheet while a version is being read: which one, how far it is from the draft,
 * and the two ways out. Restoring is a decision made after reading, never before.
 */
export function VersionPreviewBanner({ preview }: { preview: VersionPreview }) {
  const setPreview = useOverlayStore((s) => s.setPreview);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const { version, label } = preview;

  const changed = useMemo(
    () => countChangedLines(version.doc, { schemaVersion, contact, sections }),
    [version.doc, schemaVersion, contact, sections]
  );

  const restore = async () => {
    if (
      await attempt(
        restoreVersion(version.templateId, version.id),
        'Could not restore that version'
      )
    ) {
      showToast(`Restored “${version.summary}”`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-zinc-700 md:px-6 dark:border-amber-800 dark:bg-amber-950 dark:text-zinc-300">
      <Eye className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="min-w-0 flex-1">
        <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{label}</span>
        {' · '}
        {version.summary}
        <span className="text-zinc-500">
          {changed === 0
            ? ' — identical to your draft'
            : ` — ${changed} ${changed === 1 ? 'line differs' : 'lines differ'} from your draft`}
        </span>
      </span>
      <AppButton
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setPreview(null)}
      >
        Back to draft
      </AppButton>
      <AppButton variant="emphasis" size="xs" onClick={() => void restore()}>
        <History className="size-3" />
        Restore this version
      </AppButton>
    </div>
  );
}
