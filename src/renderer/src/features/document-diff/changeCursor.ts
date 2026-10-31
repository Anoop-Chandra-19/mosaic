import { createContext, use, useState } from 'react';
import type { Change } from '@/lib/resume/changes/resumeChange';

/** The change being read, shared with the marks without laying the page out again. */
export const CurrentChange = createContext<{
  currentId: string | null;
  pick: (id: string) => void;
}>({ currentId: null, pick: () => {} });

/**
 * Which of `changes` is being read, by its place in them. It goes back to `startAt` for each
 * `placeKey` (a version and what it is compared with), or when the changes no longer reach it.
 */
export function useChangeCursor(changes: readonly Change[], placeKey: string, startAt: number) {
  const [cursorAt, setCursorAt] = useState({ key: placeKey, index: startAt });
  const index =
    cursorAt.key === placeKey && cursorAt.index < changes.length ? cursorAt.index : startAt;
  const moveTo = (next: number) => setCursorAt({ key: placeKey, index: next });
  return {
    index,
    moveTo,
    currentId: changes[index]?.id ?? null,
    pick: (id: string) => moveTo(changes.findIndex((change) => change.id === id)),
  };
}

/**
 * What a marked line does with the current change. `changes` are what it stands for; a click
 * on a line with none of its own, such as the bullet of an entry that went, picks the change
 * in `clickedChanges` it is part of.
 */
export function useLineCursor(changes: readonly Change[], clickedChanges = changes) {
  const { currentId, pick } = use(CurrentChange);
  const ownIds = changes.filter((change) => !change.parentId).map((change) => change.id);
  const isCurrent = currentId !== null && ownIds.includes(currentId);
  const pickLine = () => {
    // Selecting words on the line to copy them is not choosing it.
    if (isCurrent || !window.getSelection()?.isCollapsed) return;
    const clicked = clickedChanges[0];
    const id = ownIds[0] ?? clicked?.parentId ?? clicked?.id;
    if (id) pick(id);
  };
  return { markIds: ownIds.join(' ') || undefined, isCurrent, pickLine };
}
