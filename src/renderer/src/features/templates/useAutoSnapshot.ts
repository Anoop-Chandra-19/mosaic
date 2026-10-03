import { useEffect } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';

/*
 * Undo is a session; versions are what survives quitting. With "While you work" on, the
 * draft is kept once editing pauses, so an afternoon without naming a version doesn't come
 * back as the version before it. A pause, not a count of edits, is what keeps history
 * readable instead of a row per keystroke. Switching template and closing the window keep
 * it too (`snapshotOpenDraft`).
 */

/** How long the draft sits unedited before it is kept. */
export const IDLE_SNAPSHOT_MS = 2 * 60_000;

/** Takes an auto version of the open draft when editing pauses, if the user asked for it. */
export function useAutoSnapshot(): void {
  const isOn = useUiStore((s) => s.snapshotTriggers.whileWorking);
  const templateId = useResumeStore((s) => s.templateId);
  const rev = useResumeStore((s) => s.rev);
  const isDirty = useResumeStore((s) => s.rev !== s.baselineRev);

  useEffect(() => {
    if (!isOn || templateId === null || !isDirty) return;
    // Each edit moves the rev, which starts the wait again.
    const timer = setTimeout(
      () => void useTemplateStore.getState().snapshotOpenDraft('edit'),
      IDLE_SNAPSHOT_MS
    );
    return () => clearTimeout(timer);
  }, [isOn, templateId, isDirty, rev]);
}
