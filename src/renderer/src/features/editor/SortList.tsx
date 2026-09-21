import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { GripVertical } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import { moveToSlot } from './listOrder';

/*
 * Drag to reorder, for the editor's three lists. Nothing moves until the drag is dropped:
 * the row being carried stays where it is, ghosted, and an amber line shows where it would
 * land. One reorder reaches the store per drag, so it is one undo step.
 *
 * The grip is a pointer affordance and is out of the tab order on purpose: every list also
 * has Move up and Move down in its menu, which is how this is done from the keyboard.
 */

/** What is being dragged, which only sets how far the drop line is inset. */
export type SortKind = 'section' | 'entry' | 'bullet';

/** How near a scrolling edge the pointer has to be before the list scrolls under it. */
const EDGE_ZONE_PX = 48;
/** The fastest it scrolls, with the pointer at the edge or past it. */
const MAX_SCROLL_PX_PER_FRAME = 16;

/** The nearest ancestor that scrolls: for the editor, the sidebar's tab. */
function findScrollParent(element: Element): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/** Pixels to scroll this frame: up near the top, down near the bottom, faster nearer. */
function measureEdgeScroll(clientY: number, box: DOMRect): number {
  const intoTop = box.top + EDGE_ZONE_PX - clientY;
  const intoBottom = clientY - (box.bottom - EDGE_ZONE_PX);
  const depth = Math.max(intoTop, intoBottom);
  if (depth <= 0) return 0;
  const speed = Math.ceil(MAX_SCROLL_PX_PER_FRAME * Math.min(1, depth / EDGE_ZONE_PX));
  return intoTop > 0 ? -speed : speed;
}

export interface SortGrip {
  /** Spread on the row's grip. */
  onPointerDown: (event: ReactPointerEvent) => void;
  /** This row is the one being carried. */
  lifted: boolean;
}

interface SortListProps {
  /** The rows, in the order they are shown. */
  ids: string[];
  kind: SortKind;
  /** The whole order, every time, so the store takes one step per drag. */
  onReorder: (orderedIds: string[]) => void;
  /** The list's own layout; a slot never changes the flow of the row it wraps. */
  className?: string;
  renderRow: (id: string, grip: SortGrip) => ReactNode;
}

function DropLine({ kind, atEnd = false }: { kind: SortKind; atEnd?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-10 h-0.5 rounded-sm bg-amber-500 ring-2 ring-amber-soft',
        atEnd ? '-bottom-px' : '-top-px',
        kind === 'bullet' ? 'left-3 right-1.5' : 'left-1.5 right-1'
      )}
    />
  );
}

export function SortList({ ids, kind, onReorder, className, renderRow }: SortListProps) {
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  /** Where the carried row would land: the slot it goes before, or past the last one. */
  const [dropAt, setDropAt] = useState<number | null>(null);
  // A long list runs past the sidebar, and a row can only be dropped where it can be seen,
  // so holding the pointer near an edge scrolls the sidebar under it.
  const scroller = useRef<HTMLElement | null>(null);
  const pointerY = useRef(0);
  const scrollFrame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    },
    []
  );

  /** The first slot whose middle the pointer has not passed; past them all, the end. */
  const slotAt = (clientY: number) => {
    for (let i = 0; i < ids.length; i += 1) {
      const box = slots.current[i]?.getBoundingClientRect();
      if (box && clientY < box.top + box.height / 2) return i;
    }
    return ids.length;
  };

  const startDrag = (id: string) => (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // The grip keeps the pointer for the whole drag: rows passed over cannot take it, and
    // their hover states stay down while it is held.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedId(id);
    setDropAt(ids.indexOf(id));
  };

  /** One frame of scrolling. It stops itself once the pointer leaves the edge, or the end is reached. */
  const scrollStep = () => {
    scrollFrame.current = null;
    const box = scroller.current;
    if (!box) return;
    const speed = measureEdgeScroll(pointerY.current, box.getBoundingClientRect());
    if (speed === 0) return;
    const before = box.scrollTop;
    box.scrollTop += speed;
    if (box.scrollTop === before) return;
    // The rows moved under a pointer that did not, so where it would land moved too.
    setDropAt(slotAt(pointerY.current));
    scrollFrame.current = requestAnimationFrame(scrollStep);
  };

  const stopScrolling = () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
  };

  const trackDrag = (event: ReactPointerEvent) => {
    if (draggedId === null) return;
    scroller.current ??= findScrollParent(event.currentTarget);
    pointerY.current = event.clientY;
    setDropAt(slotAt(event.clientY));
    if (scrollFrame.current === null) scrollFrame.current = requestAnimationFrame(scrollStep);
  };

  const endDrag = () => {
    stopScrolling();
    if (draggedId !== null && dropAt !== null) {
      const next = moveToSlot(ids, draggedId, dropAt);
      if (next) onReorder(next);
    }
    setDraggedId(null);
    setDropAt(null);
  };

  return (
    <div
      className={className}
      onPointerMove={trackDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {ids.map((id, i) => (
        <div
          key={id}
          ref={(el) => {
            slots.current[i] = el;
          }}
          className="relative"
        >
          {dropAt === i && <DropLine kind={kind} />}
          {/* Dropping past the last row draws under it, so no slot is added to the flow. */}
          {dropAt === ids.length && i === ids.length - 1 && <DropLine kind={kind} atEnd />}
          <div className={cn(draggedId === id && 'opacity-40')}>
            {renderRow(id, { onPointerDown: startDrag(id), lifted: draggedId === id })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The handle a row shows on hover. `className` places it; the look belongs here. */
export function SortGripHandle({
  grip,
  label,
  className,
}: {
  grip: SortGrip;
  label: string;
  className?: string;
}) {
  return (
    <AppButton
      variant="ghost"
      size="2xs"
      shape="rect"
      tabIndex={-1}
      aria-label={label}
      title="Drag to reorder"
      onPointerDown={grip.onPointerDown}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'h-5 w-3.25 cursor-grab touch-none rounded-[0.25rem] px-0 text-ink-soft',
        'hover:bg-amber-soft hover:text-amber-600 active:cursor-grabbing dark:hover:text-amber-400',
        grip.lifted && 'cursor-grabbing',
        className
      )}
    >
      <GripVertical className="size-3.5" />
    </AppButton>
  );
}
