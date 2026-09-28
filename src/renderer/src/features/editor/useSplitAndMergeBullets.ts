import { useLayoutEffect, useRef, useState } from 'react';
import {
  easeHeightFrom,
  findFirstLineTop,
  foldInto,
  travelFrom,
} from '@/lib/motion/moveTextBetweenRows';
import { recordPlaces, slideFromRecordedPlaces } from '@/lib/motion/slideToNewPlaces';
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
const ROW = 'data-sort-id';
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

/** An entry's splits and merges, and how its rows move through them. */
export function useSplitAndMergeBullets(sectionId: string, entry: ResumeEntry) {
  const splitBullet = useResumeStore((s) => s.splitBullet);
  const mergeBullets = useResumeStore((s) => s.mergeBullets);
  const listRef = useRef<HTMLDivElement>(null);
  const [merging, setMerging] = useState<Merging | null>(null);
  const [openAfterSplitId, setOpenAfterSplitId] = useState<string | null>(null);
  const [tints, setTints] = useState<Record<string, BulletTint>>({});
  const tintTimer = useRef(0);
  const playAfterRender = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const play = playAfterRender.current;
    playAfterRender.current = null;
    play?.();
  });

  const tint = (next: Record<string, BulletTint>) => {
    setTints(next);
    window.clearTimeout(tintTimer.current);
    tintTimer.current = window.setTimeout(() => setTints({}), TINT_MS);
  };

  /**
   * Measures the list now and moves its rows once the change has rendered. Motion still
   * running finishes first, so the measure is of where things really are.
   */
  const moveRowsAfterRender = (then?: (list: HTMLElement, tailTop: number | null) => void) => {
    const list = listRef.current;
    if (!list) return;
    for (const animation of list.getAnimations({ subtree: true })) animation.finish();
    const heightPx = list.offsetHeight;
    const places = recordPlaces(list, ROW);
    const tailTop = findFirstLineTop(list.querySelector(TAIL));
    playAfterRender.current = () => {
      easeHeightFrom(list, heightPx);
      slideFromRecordedPlaces(list, ROW, places);
      then?.(list, tailTop);
    };
  };

  const findRow = (list: HTMLElement, id: string) =>
    list.querySelector<HTMLElement>(`[${ROW}="${CSS.escape(id)}"]`);

  const split = (bullet: Bullet, text: string, at: number) => {
    let newId: string | null = null;
    moveRowsAfterRender((list, tailTop) => {
      const row = newId && findRow(list, newId);
      if (row && tailTop !== null) travelFrom(row, tailTop);
    });
    newId = splitBullet(sectionId, entry.id, bullet.id, text, at);
    if (!newId) {
      playAfterRender.current = null;
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
    const list = listRef.current;
    const secondRow = list && findRow(list, second.id);
    const secondRect = secondRow?.getBoundingClientRect();
    moveRowsAfterRender((list) => {
      const toTop = findFirstLineTop(list.querySelector(TAIL));
      if (secondRow && secondRect && toTop !== null) foldInto(list, secondRow, secondRect, toTop);
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
    const { secondId } = merging;
    moveRowsAfterRender((list, tailTop) => {
      const row = findRow(list, secondId);
      if (row && tailTop !== null) travelFrom(row, tailTop);
    });
    setMerging(null);
    tint({ [secondId]: 'carried' });
  };

  const confirmMerge = (text: string, selected: boolean) => {
    if (!merging) return;
    moveRowsAfterRender();
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
    listRef,
    /** The bullet folded into a merge, off the list until it ends. */
    hiddenBulletId: merging?.secondId ?? null,
    bulletRowProps,
  };
}
