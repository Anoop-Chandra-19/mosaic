import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from 'radix-ui';
import { HINTED, hasHintContent, readHint, watchHints, type HintSide } from './hintRegistry';

/*
 * The app's one hint. Every `AppTooltip` only marks its element; this watches the pointer,
 * focus and keys for the whole document and shows the hint of the element they are on, so a
 * screen of hinted controls mounts one tooltip, not one each.
 */

/** Before the first hint; the next one follows at once (`SKIP_DELAY_MS`). */
const OPEN_DELAY_MS = 700;
const SKIP_DELAY_MS = 300;

/**
 * Whether the person last moved focus themselves, with Tab or the arrow keys. Focus alone
 * cannot say: Chromium marks the focus a closing menu hands back as `:focus-visible` even
 * when the menu was used with the mouse. Nor can any key: a shortcut that opens a dialog
 * lands focus on its close button, and a hint there would take the first Escape.
 */
const FOCUS_MOVING_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

interface Point {
  x: number;
  y: number;
}

interface ShownHint {
  id: string;
  element: HTMLElement;
  rect: DOMRect;
  /** Where the pointer is, for a hint that follows it. */
  pointer: Point | null;
  /** Counts each showing, so a new one starts fresh. */
  showing: number;
}

interface HintRequests {
  /** Closes the hint, as when Radix dismisses it. */
  close: () => void;
  /** A hint changed or went: close it if it can no longer show. */
  recheck: () => void;
  stop: () => void;
}

/** The innermost hinted element: a control inside hinted text speaks for itself. */
function findHinted(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(`[${HINTED}]`) : null;
}

function canShowHint(element: HTMLElement): boolean {
  const hint = readHint(element.getAttribute(HINTED) ?? '');
  return (
    element.isConnected && hint !== undefined && !hint.isDisabled && hasHintContent(hint.content)
  );
}

/**
 * Decides which element's hint shows and when, from the pointer, focus and keys. A hint
 * waits a moment under the pointer, closes the moment the pointer leaves, and stays down
 * after a press until the pointer has left. Focus shows one at once, but only after Tab or
 * an arrow key, never focus a closing menu hands back.
 */
function watchHintRequests(
  open: (element: HTMLElement, pointer: Point | null) => void,
  close: () => void,
  follow: (pointer: Point) => void
): HintRequests {
  let hovered: HTMLElement | null = null;
  let pressed: HTMLElement | null = null;
  let shown: HTMLElement | null = null;
  let isShownByFocus = false;
  let pointer: Point | null = null;
  let timer = 0;
  let closedAt = -Infinity;
  let isKeyboardInput = false;

  const show = (element: HTMLElement, isByFocus: boolean) => {
    window.clearTimeout(timer);
    timer = 0;
    shown = element;
    isShownByFocus = isByFocus;
    open(element, isByFocus ? null : pointer);
  };
  const hide = () => {
    window.clearTimeout(timer);
    timer = 0;
    if (!shown) return;
    shown = null;
    closedAt = performance.now();
    close();
  };
  const askOnHover = () => {
    const waiting = hovered;
    if (!waiting || waiting === shown || waiting === pressed || timer) return;
    if (!canShowHint(waiting)) return;
    if (performance.now() - closedAt < SKIP_DELAY_MS) {
      show(waiting, false);
      return;
    }
    timer = window.setTimeout(() => {
      timer = 0;
      if (hovered === waiting && canShowHint(waiting)) show(waiting, false);
    }, OPEN_DELAY_MS);
  };
  const leaveFor = (next: HTMLElement | null) => {
    if (next === hovered) return;
    hovered = next;
    if (next !== pressed) pressed = null;
    window.clearTimeout(timer);
    timer = 0;
    if (shown && shown !== next && !isShownByFocus) hide();
  };

  const handlePointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    leaveFor(findHinted(event.target));
  };
  const handlePointerOut = (event: PointerEvent) => {
    if (event.relatedTarget === null) leaveFor(null);
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (shown && shown === hovered) follow(pointer);
    askOnHover();
  };
  const handlePointerDown = () => {
    isKeyboardInput = false;
    pressed = hovered;
    hide();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    isKeyboardInput = FOCUS_MOVING_KEYS.has(event.key);
  };
  const handleFocusIn = (event: FocusEvent) => {
    const element = event.target;
    if (!isKeyboardInput || !(element instanceof HTMLElement)) return;
    if (!element.hasAttribute(HINTED) || !canShowHint(element)) return;
    show(element, true);
  };
  const handleFocusOut = (event: FocusEvent) => {
    if (event.target === shown) hide();
  };
  const handleScroll = (event: Event) => {
    if (shown && event.target instanceof Node && event.target.contains(shown)) hide();
  };

  // Captured, so a control that stops its events can't keep a hint up.
  const listeners = [
    ['pointerover', handlePointerOver],
    ['pointerout', handlePointerOut],
    ['pointermove', handlePointerMove],
    ['pointerdown', handlePointerDown],
    ['keydown', handleKeyDown],
    ['focusin', handleFocusIn],
    ['focusout', handleFocusOut],
    ['scroll', handleScroll],
  ] as const;
  for (const [type, listener] of listeners) {
    document.addEventListener(type, listener as EventListener, true);
  }

  return {
    close: hide,
    recheck: () => {
      if (shown && !canShowHint(shown)) hide();
    },
    stop: () => {
      window.clearTimeout(timer);
      for (const [type, listener] of listeners) {
        document.removeEventListener(type, listener as EventListener, true);
      }
    },
  };
}

/**
 * A hint is never under the pointer, so one drawn over the next button can't block it.
 * Radix places the hint inside a wrapper of its own, which is what the pointer would hit.
 */
function letPointerThrough(content: HTMLDivElement | null) {
  content?.parentElement?.classList.add('pointer-events-none');
}

function isBeside(side: HintSide): boolean {
  return side === 'left' || side === 'right';
}

/** How far along the element the pointer is: across it, or down it for a hint beside it. */
function measurePointerAlong(shown: ShownHint, side: HintSide): number {
  if (!shown.pointer) return (isBeside(side) ? shown.rect.height : shown.rect.width) / 2;
  return isBeside(side) ? shown.pointer.y - shown.rect.top : shown.pointer.x - shown.rect.left;
}

/** Lends the element the hint's description while it shows, as Radix does for its trigger. */
function useDescribedBy(shown: ShownHint | null, anchor: HTMLSpanElement | null) {
  useLayoutEffect(() => {
    const describedBy = anchor?.getAttribute('aria-describedby');
    if (!shown || !describedBy) return;
    const { element } = shown;
    const own = element.getAttribute('aria-describedby');
    element.setAttribute('aria-describedby', own ? `${own} ${describedBy}` : describedBy);
    return () => {
      if (own === null) element.removeAttribute('aria-describedby');
      else element.setAttribute('aria-describedby', own);
    };
  }, [shown, anchor]);
}

export function HintLayer() {
  const [shown, setShown] = useState<ShownHint | null>(null);
  const [hintLength, setHintLength] = useState(0);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [, setHintsChanged] = useState(0);
  const requests = useRef<HintRequests | null>(null);

  useEffect(() => {
    let showings = 0;
    let shownId: string | null = null;
    const watching = watchHintRequests(
      (element, pointer) => {
        showings += 1;
        shownId = element.getAttribute(HINTED) ?? '';
        setShown({
          id: shownId,
          element,
          rect: element.getBoundingClientRect(),
          pointer,
          showing: showings,
        });
      },
      () => {
        shownId = null;
        setShown(null);
      },
      (pointer) => setShown((current) => current && { ...current, pointer })
    );
    requests.current = watching;
    const stopWatchingHints = watchHints((id) => {
      if (id !== shownId) return;
      watching.recheck();
      setHintsChanged((count) => count + 1);
    });
    return () => {
      stopWatchingHints();
      watching.stop();
      requests.current = null;
    };
  }, []);

  useDescribedBy(shown, anchor);

  const hint = shown ? readHint(shown.id) : undefined;
  if (!shown || !hint) return null;
  const { rect } = shown;
  return (
    <Tooltip.Root
      key={shown.showing}
      open
      onOpenChange={(isOpen) => isOpen || requests.current?.close()}
    >
      {/* Laid over the element, for Radix to place the hint against. */}
      <Tooltip.Trigger asChild>
        <span
          ref={setAnchor}
          aria-hidden
          className="pointer-events-none fixed"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={hint.side}
          align={hint.shouldFollowPointer ? 'start' : hint.align}
          // Centred on the pointer: its place along the element, less half the hint.
          alignOffset={
            hint.shouldFollowPointer ? measurePointerAlong(shown, hint.side) - hintLength / 2 : 0
          }
          sideOffset={6}
          collisionPadding={8}
          ref={(node) => {
            letPointerThrough(node);
            if (node && hint.shouldFollowPointer) {
              setHintLength(isBeside(hint.side) ? node.offsetHeight : node.offsetWidth);
            }
          }}
          className="z-50 max-w-72 rounded-md border border-line-strong bg-background px-2.5 py-1.5 text-support text-pretty text-foreground shadow-floating animate-in fade-in-0 data-[state=closed]:animate-none"
        >
          {hint.content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
