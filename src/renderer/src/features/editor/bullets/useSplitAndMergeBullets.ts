import { useRef, useState } from 'react';
import { findFirstLineTop, foldOnto, leaveInPlace, travelFrom } from '@/lib/motion/rowMotions';
import { useListMotion, useSwapMotion } from '@/lib/motion/useListMotion';
import { showToast } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import type { Bullet, ResumeEntry } from '@shared/types/resume';
import type { BulletMerge } from './BulletEditor';
import { joinBulletTexts } from './splitAndMergeBullets';

/** The row that stayed put washes; the one that arrived keeps the tail's tint. */
export type BulletTint = 'fresh' | 'carried';

interface Merging {
  firstId: string;
  secondId: string;
  text: string;
  seam: number;
  isFirstSelected: boolean;
  isSecondSelected: boolean;
}

const TINT_MS = 1150;
const TAIL = '[data-split-tail]';

/** Undo only while the step is still the last one, so it never takes back another. */
function offerUndo(message: string) {
  const { rev } = useResumeStore.getState();
  showToast(message, 'success', {
    label: 'Undo',
    run: () => {
      const store = useResumeStore.getState();
      if (store.rev === rev) store.undo();
    },
  });
}

/**
 * An entry's bullet list as it moves: every change to it through `useListMotion`, and
 * splits and merges, whose rows move out of and into the editor's tinted text.
 */
export function useSplitAndMergeBullets(sectionId: string, entry: ResumeEntry) {
  const splitBullet = useResumeStore((s) => s.splitBullet);
  const mergeBullets = useResumeStore((s) => s.mergeBullets);
  const [merging, setMerging] = useState<Merging | null>(null);
  const [openAfterSplitId, setOpenAfterSplitId] = useState<string | null>(null);
  const [tints, setTints] = useState<Record<string, BulletTint>>({});
  const tintTimer = useRef(0);
  // The bullet folded into a merge is off the list until it ends.
  const shownIds = entry.bullets.map((b) => b.id).filter((id) => id !== merging?.secondId);
  const [listRef, motion] = useListMotion(shownIds.join(' '));
  const beginMergeSwap = useSwapMotion(merging, motion);

  const tint = (next: Record<string, BulletTint>) => {
    setTints(next);
    window.clearTimeout(tintTimer.current);
    tintTimer.current = window.setTimeout(() => setTints({}), TINT_MS);
  };

  const findTailTop = () => findFirstLineTop(motion.getBox()?.querySelector(TAIL) ?? null);

  /** The next arrival travels out of the tinted text, from where it is now. */
  const expectArrivalFromTail = () => {
    const tailTop = findTailTop();
    motion.expect({ arrive: (row) => tailTop !== null && travelFrom(row, tailTop) });
  };

  const split = (bullet: Bullet, text: string, at: number) => {
    expectArrivalFromTail();
    const newId = splitBullet(sectionId, entry.id, bullet.id, text, at);
    if (!newId) {
      motion.expect({});
      return;
    }
    setOpenAfterSplitId(newId);
    tint({ [bullet.id]: 'fresh', [newId]: 'carried' });
    offerUndo(
      bullet.selected
        ? 'Split into two bullets'
        : 'Split into two bullets. Both stay off the resume.'
    );
  };

  const startMerge = (first: Bullet, firstText: string) => {
    const second = entry.bullets[entry.bullets.findIndex((b) => b.id === first.id) + 1];
    if (!second) return;
    motion.expect({
      leave: (box, place) => {
        const toTop = findTailTop();
        if (toTop === null) leaveInPlace(box, place);
        else foldOnto(box, place, toTop);
      },
    });
    const { text, seam } = joinBulletTexts(firstText, second.text);
    setMerging({
      firstId: first.id,
      secondId: second.id,
      text,
      seam,
      isFirstSelected: first.selected,
      isSecondSelected: second.selected,
    });
  };

  const cancelMerge = () => {
    if (!merging) return;
    expectArrivalFromTail();
    setMerging(null);
    tint({ [merging.secondId]: 'carried' });
  };

  const confirmMerge = (text: string, selected: boolean) => {
    if (!merging) return;
    // The list keeps its rows (the second already left it); only the editor becomes a row.
    beginMergeSwap();
    const isMerged = mergeBullets(
      sectionId,
      entry.id,
      merging.firstId,
      merging.secondId,
      text,
      selected
    );
    setMerging(null);
    if (!isMerged) return;
    tint({ [merging.firstId]: 'fresh' });
    offerUndo(
      selected ? 'Merged two bullets' : 'Merged two bullets. The merged bullet is off the resume.'
    );
  };

  const bulletRowProps = (bullet: Bullet) => {
    const merge: (BulletMerge & { text: string; onCancel: () => void }) | undefined =
      merging?.firstId === bullet.id
        ? {
            text: merging.text,
            seam: merging.seam,
            isFirstSelected: merging.isFirstSelected,
            isSecondSelected: merging.isSecondSelected,
            onMerge: confirmMerge,
            onCancel: cancelMerge,
          }
        : undefined;
    const opensAfterSplit = openAfterSplitId === bullet.id;
    return {
      onSplit: (text: string, at: number) => split(bullet, text, at),
      onStartMerge: (text: string) => startMerge(bullet, text),
      merge,
      opensAfterSplit,
      onEditorClose: opensAfterSplit ? () => setOpenAfterSplitId(null) : undefined,
      tint: tints[bullet.id],
    };
  };

  return {
    motion,
    listRef,
    shownIds,
    isMerging: merging !== null,
    bulletRowProps,
  };
}
