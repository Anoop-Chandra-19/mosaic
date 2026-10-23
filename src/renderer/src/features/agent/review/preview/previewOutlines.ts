import type { PreviewPart, PreviewTarget } from './suggestionPreview';

/** A box drawn over the pages, in the layer laid over them. */
export interface Outline {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Where the preview names each part it draws. A section's entries carry its id too. */
const PART_ATTRIBUTES: Record<PreviewPart, string> = {
  bullet: 'data-preview-bullet-id',
  item: 'data-preview-entry-id',
  section: 'data-preview-section-id',
  heading: 'data-preview-section-title-id',
};

/** Boxes closer than this join into one shape; a page gap keeps them apart. */
const JOIN_WITHIN_PX = 14;

/**
 * One shape per stretch of what a suggestion made, not one per line: the parts' boxes on
 * the drawn pages (never the offscreen measuring copy), joined where they nearly touch, a
 * little outside the text.
 */
export function measureOutlines(
  pages: HTMLElement,
  layer: HTMLElement,
  targets: readonly PreviewTarget[]
): Outline[] {
  const origin = layer.getBoundingClientRect();
  const boxes = targets
    .flatMap(({ part, id }) => [
      ...pages.querySelectorAll(
        `[data-preview-stack] [${PART_ATTRIBUTES[part]}="${CSS.escape(id)}"]`
      ),
    ])
    .map((node) => node.getBoundingClientRect())
    .filter((box) => box.height > 0)
    .sort((a, b) => a.top - b.top);
  const joined: { top: number; bottom: number; left: number; right: number }[] = [];
  for (const box of boxes) {
    const last = joined.at(-1);
    if (last && box.top - last.bottom < JOIN_WITHIN_PX) {
      last.bottom = Math.max(last.bottom, box.bottom);
      last.left = Math.min(last.left, box.left);
      last.right = Math.max(last.right, box.right);
    } else {
      joined.push({ top: box.top, bottom: box.bottom, left: box.left, right: box.right });
    }
  }
  return joined.map((shape) => ({
    top: shape.top - origin.top - 3,
    left: shape.left - origin.left - 4,
    width: shape.right - shape.left + 8,
    height: shape.bottom - shape.top + 6,
  }));
}

export function isSameOutlines(a: readonly Outline[], b: readonly Outline[]): boolean {
  return a.length === b.length && a.every((shape, index) => isSameOutline(shape, b[index]));
}

const isSameOutline = (a: Outline, b: Outline) =>
  a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * Brings what a suggestion made into view, a third of the way down, unless it is already
 * clear of the edges and of the apply bar floating at the foot. No smooth scroll.
 */
export function revealOutline(scrollBox: HTMLElement, layer: HTMLElement, outline: Outline) {
  const box = scrollBox.getBoundingClientRect();
  const top = layer.getBoundingClientRect().top + outline.top;
  const bottom = top + outline.height;
  if (top >= box.top + 24 && bottom <= box.bottom - 72) return;
  scrollBox.scrollTop = Math.max(0, scrollBox.scrollTop + top - box.top - box.height / 3);
}
