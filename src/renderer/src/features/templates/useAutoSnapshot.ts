import { useEffect } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useActiveTemplate } from './useActiveTemplate';

/*
 * Undo is a session; versions are what survives quitting. Editing alone used to leave no
 * trace in history, so an afternoon without Ctrl/⌘+S came back as the version before it.
 * The draft is kept once it has moved far enough from the newest version, and no more
 * often than the interval, which is what keeps history readable instead of a row per
 * keystroke. Switching template and closing the window keep it too, wherever it stands.
 */

/** How many steps from the newest version make the draft worth keeping. */
export const AUTO_SNAPSHOT_CHANGES = 20;
/** And how long apart two of these versions may be. */
export const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60_000;

/** `changes` counts steps since the newest version: edits, undos, and redos alike. */
export function isAutoSnapshotDue(changes: number): boolean {
  return changes >= AUTO_SNAPSHOT_CHANGES;
}

/** How long a due snapshot waits, counted from the newest version rather than from now. */
export function msUntilAutoSnapshot(lastVersionAt: number, now: number): number {
  return Math.max(0, lastVersionAt + AUTO_SNAPSHOT_INTERVAL_MS - now);
}

/** Takes an auto version of the open draft as the editing goes on. */
export function useAutoSnapshot(): void {
  const templateId = useResumeStore((s) => s.templateId);
  const changes = useResumeStore((s) => s.rev - s.baselineRev);
  const lastVersionAt = useActiveTemplate()?.head.createdAt ?? 0;
  const due = templateId !== null && isAutoSnapshotDue(changes);

  useEffect(() => {
    if (!due) return;
    // The wait runs from the last version, not from the last keystroke, so editing on
    // cannot put the snapshot off forever — those edits just land in it too.
    const timer = setTimeout(
      () => void useTemplateStore.getState().snapshotOpenDraft('edit'),
      msUntilAutoSnapshot(lastVersionAt, Date.now())
    );
    return () => clearTimeout(timer);
  }, [due, lastVersionAt]);
}
