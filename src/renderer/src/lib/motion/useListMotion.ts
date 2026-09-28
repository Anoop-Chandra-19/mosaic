import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { MOTION_MS, prefersReducedMotion } from './motionTiming';
import {
  appear,
  easeHeightFrom,
  finishRowMotions,
  leaveInPlace,
  listRowMotions,
  slideFrom,
  type RowPlace,
} from './rowMotions';

const BOX = 'data-motion-box';

interface Snapshot {
  heightPx: number;
  places: Map<string, RowPlace>;
}

/** How the next change's arrivals and departures move, in place of fading. */
export interface ExpectedChange {
  arrive?: (row: HTMLElement) => void;
  leave?: (box: HTMLElement, place: RowPlace) => void;
}

export interface ListMotion {
  /** The list's box. It must be positioned: rows that leave are drawn in it. */
  getBox: () => HTMLElement | null;
  expect: (change: ExpectedChange) => void;
  /** Before a row changes what it shows; `finishSwap` once that has rendered. */
  beginSwap: () => void;
  finishSwap: () => void;
}

/** Rows marked with `attribute` that belong to this box, not to a list nested in it. */
function findOwnRows(box: HTMLElement, attribute: string): Map<string, HTMLElement> {
  const rows = new Map<string, HTMLElement>();
  for (const row of box.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    if (row.closest(`[${BOX}]`) === box) rows.set(row.getAttribute(attribute)!, row);
  }
  return rows;
}

function takeSnapshot(box: HTMLElement, attribute: string): Snapshot {
  const boxRect = box.getBoundingClientRect();
  const places = new Map<string, RowPlace>();
  for (const [id, element] of findOwnRows(box, attribute)) {
    const rect = element.getBoundingClientRect();
    places.set(id, {
      element,
      top: rect.top - boxRect.top,
      left: rect.left - boxRect.left,
      width: rect.width,
    });
  }
  return { heightPx: box.offsetHeight, places };
}

/** The row marked with `attribute` that holds `row` in the same box, if any. */
function findParentId(row: Element, box: HTMLElement, attribute: string): string | null {
  const parent = row.parentElement?.closest(`[${attribute}]`);
  if (!parent || !box.contains(parent) || parent.closest(`[${BOX}]`) !== box) return null;
  return parent.getAttribute(attribute);
}

function moveRows(
  box: HTMLElement,
  attribute: string,
  before: Snapshot,
  now: Snapshot,
  expected: ExpectedChange
) {
  if (prefersReducedMotion()) return;
  const isNew = (id: string) => !before.places.has(id);
  const isGone = (id: string) => !now.places.has(id);
  // A row inside one that came or went moves with it.
  const arrived = [...now.places].filter(([id, place]) => {
    const parentId = findParentId(place.element, box, attribute);
    return isNew(id) && !(parentId && isNew(parentId));
  });
  const left = [...before.places].filter(([id, place]) => {
    if (!isGone(id) || place.element.isConnected) return false;
    const parentId = findParentId(place.element, box, attribute);
    return !(parentId && before.places.has(parentId) && isGone(parentId));
  });
  // Only leaving: the text fades first, then the space closes.
  const delayMs = left.length > 0 && arrived.length === 0 ? MOTION_MS.leave : 0;

  easeHeightFrom(box, before.heightPx, delayMs);

  const shifts = new Map<string, { dx: number; dy: number }>();
  for (const [id, place] of now.places) {
    const was = before.places.get(id);
    if (was) shifts.set(id, { dx: was.left - place.left, dy: was.top - place.top });
  }
  for (const [id, { dx, dy }] of shifts) {
    const row = now.places.get(id)!.element;
    // A nested row already moves with its parent; it only makes up the difference.
    const parentId = findParentId(row, box, attribute);
    const parent = parentId ? shifts.get(parentId) : undefined;
    const x = dx - (parent?.dx ?? 0);
    const y = dy - (parent?.dy ?? 0);
    if (Math.abs(x) >= 1 || Math.abs(y) >= 1) slideFrom(row, x, y, delayMs);
  }

  for (const [, place] of arrived) (expected.arrive ?? appear)(place.element);
  for (const [, place] of left) {
    place.element.removeAttribute(attribute);
    (expected.leave ?? leaveInPlace)(box, place);
  }
}

/**
 * Moves the rows marked with `attribute` through each change to `signature` (which changes
 * when rows come, go, or reorder): they slide, arrive, and leave, and the box eases to its
 * height. A list nested in the box moves on its own.
 *
 * The box's ref comes apart from the controls: read off them, the lint would take the
 * controls for a ref too.
 */
export function useListMotion(
  signature: string,
  attribute = 'data-sort-id'
): [listRef: (box: HTMLElement | null) => void, motion: ListMotion] {
  const [motion] = useState(() => new ListMotionController(signature, attribute));
  useLayoutEffect(() => motion.showSignature(signature));
  return [motion.attach, motion];
}

/** Plain fields, not React refs: it measures the page, and nothing it holds is rendered. */
class ListMotionController implements ListMotion {
  private box: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private last: Snapshot | null = null;
  private expected: ExpectedChange = {};
  private beforeSwap: Snapshot | null = null;
  private shownSignature: string;
  private readonly attribute: string;

  constructor(signature: string, attribute: string) {
    this.shownSignature = signature;
    this.attribute = attribute;
  }

  attach = (box: HTMLElement | null) => {
    if (box === this.box) return;
    this.observer?.disconnect();
    this.observer = null;
    this.box = box;
    if (!box) return;
    box.setAttribute(BOX, '');
    // Wrapping at a new width moves rows without any change to the list.
    this.observer = new ResizeObserver(this.record);
    this.observer.observe(box);
  };

  getBox = () => this.box;

  expect = (change: ExpectedChange) => {
    this.expected = change;
  };

  beginSwap = () => {
    const box = this.box;
    if (!box) return;
    finishRowMotions(box);
    this.beforeSwap = takeSnapshot(box, this.attribute);
  };

  finishSwap = () => {
    const box = this.box;
    const before = this.beforeSwap;
    this.beforeSwap = null;
    if (!box || !before) return;
    moveRows(box, this.attribute, before, takeSnapshot(box, this.attribute), {});
    this.record();
  };

  /** After each render: moves the rows if the list changed, then notes where they rest. */
  showSignature(signature: string) {
    const box = this.box;
    if (!box) return;
    if (signature !== this.shownSignature) {
      this.shownSignature = signature;
      if (this.last) {
        finishRowMotions(box);
        moveRows(box, this.attribute, this.last, takeSnapshot(box, this.attribute), this.expected);
      }
      this.expected = {};
    }
    this.record();
  }

  /** While rows move, once they have landed. */
  private record = () => {
    const box = this.box;
    if (!box) return;
    const moving = listRowMotions(box);
    if (moving.length === 0) {
      this.last = takeSnapshot(box, this.attribute);
      return;
    }
    void Promise.allSettled(moving.map((animation) => animation.finished)).then(this.record);
  };
}

/** The list a row belongs to, for rows that move on their own, such as by swapping. */
export const ListMotionContext = createContext<ListMotion | null>(null);

/**
 * For a row that swaps what it shows, such as a bullet opening its editor: call what this
 * returns just before the swap. `shown` is what the swap changes.
 */
export function useSwapMotion(shown: unknown, motion?: ListMotion | null): () => void {
  const nearest = useContext(ListMotionContext);
  const list = motion ?? nearest;
  useLayoutEffect(() => list?.finishSwap(), [shown, list]);
  return () => list?.beginSwap();
}
