import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { useUiStore } from '@/stores/uiStore';
import type { HistoryItem } from '../groupVersionHistory';
import { chooseHistoryTip, type ChosenHistoryTip } from './chooseHistoryTip';

/** The list has settled: rows drawn, folds and the scroll where they will stay. */
const SETTLE_MS = 450;
/** Room kept under a row for its tip to read beside it. */
const VIEW_BOTTOM_ROOM_PX = 40;

/** The key a list item opens and is found under: its newest version's id. */
export function historyItemKey(item: HistoryItem): string {
  return item.kind === 'number' ? item.revisions[0].id : item.numbers[0][0].id;
}

/** The ids a tip's row stands for: acting on any of them counts as seeing it. */
function historyItemIds(item: HistoryItem): string[] {
  return item.kind === 'number'
    ? item.revisions.map((v) => v.id)
    : item.numbers.flat().map((v) => v.id);
}

function findItemElement(root: HTMLElement, item: HistoryItem): HTMLElement | null {
  const id = historyItemKey(item);
  return item.kind === 'number'
    ? root.querySelector(`li[data-version-id="${id}"]`)
    : root.querySelector(`li[data-version-ids~="${id}"]`);
}

function findScrollBox(element: HTMLElement): HTMLElement {
  for (let box = element.parentElement; box; box = box.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(box).overflowY)) return box;
  }
  return document.documentElement;
}

/** Fully in its scroll box, with room under it: a tip never explains a row half off screen. */
function isFullyInView(element: HTMLElement): boolean {
  const row = element.getBoundingClientRect();
  const box = findScrollBox(element).getBoundingClientRect();
  return row.top >= box.top && row.bottom <= box.bottom - VIEW_BOTTOM_ROOM_PX;
}

const isDialogOpen = () =>
  document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]') !== null;

interface HistoryTipOptions {
  /** The list's root, where its rows are found. */
  listRef: RefObject<HTMLElement | null>;
  /** Newest first, as drawn: numbers and folds at the top level only. */
  items: readonly HistoryItem[];
  /** Tips belong to this list: the open template's, not a peek or the example. */
  isEnabled: boolean;
  /** A row is being named or asked about: a tip waits for the next open. */
  isBusy: boolean;
}

/**
 * One tip per open of a list, once it settles: the most basic kind of row in view whose
 * tip isn't seen yet. Showing it counts one showing; Got it, or acting on its row, sees it
 * for good. Never during the history tour, a dialog, or naming.
 */
export function useHistoryTip({ listRef, items, isEnabled, isBusy }: HistoryTipOptions) {
  const [chosen, setChosen] = useState<ChosenHistoryTip | null>(null);
  const hasLooked = useRef(false);
  const isTouring = useOverlayStore((s) => s.historyTourStep !== null);
  const hasItems = items.length > 0;

  // Reads the rows as they are when the list has settled, not as they were when it opened.
  const look = useEffectEvent(() => {
    hasLooked.current = true;
    const root = listRef.current;
    const ui = useUiStore.getState();
    if (!root || isBusy || isDialogOpen() || useOverlayStore.getState().historyTourStep !== null) {
      return;
    }
    const inView = items.filter((item) => {
      const element = findItemElement(root, item);
      return element !== null && isFullyInView(element);
    });
    const next = chooseHistoryTip(inView, ui.historyTips, { foldDays: ui.foldSnapshotsAfterDays });
    if (!next) return;
    ui.countHistoryTipShown(next.tip.id);
    setChosen(next);
  });

  useEffect(() => {
    if (!isEnabled || !hasItems || hasLooked.current) return;
    const timer = setTimeout(look, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isEnabled, hasItems]);

  const got = () => {
    if (!chosen) return;
    useUiStore.getState().markHistoryTipsSeen([chosen.tip.id]);
    setChosen(null);
  };

  /** Reading a row, opening its earlier revisions, or naming it sees its tip. */
  const noteActedOn = (versionId: string) => {
    if (chosen && historyItemIds(chosen.item).includes(versionId)) got();
  };

  return { chosen: isTouring || isBusy ? null : chosen, got, noteActedOn };
}
