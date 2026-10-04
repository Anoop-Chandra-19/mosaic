import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Tooltip } from 'radix-ui';

/*
 * Mosaic's tooltip. A native `title` is drawn by Electron as a square-cornered box that no
 * style can reach, so every hint in the app goes through here instead: a rounded card in
 * the page's own surface, with no arrow, like the design's. `AppButton` takes a `title`
 * and shows it this way, so most hints never name this component.
 */

/**
 * Whether the person last moved focus themselves, with Tab or the arrow keys. Focus alone
 * cannot say: Chromium marks the focus a closing menu hands back as `:focus-visible` even
 * when the menu was used with the mouse. Nor can any key: a shortcut that opens a dialog
 * lands focus on its close button, and a hint there would take the first Escape.
 */
let isKeyboardInput = false;

const FOCUS_MOVING_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Once for the whole app: a hint waits a moment, then the next one follows at once. It
 * closes the moment the pointer leaves, as a native hint does: a hint holds only text, so
 * there is nothing to move the pointer onto, and staying open for that covered whatever
 * was under it.
 */
export function AppTooltipProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const noteKeyboard = (event: KeyboardEvent) => {
      isKeyboardInput = FOCUS_MOVING_KEYS.has(event.key);
    };
    const notePointer = () => {
      isKeyboardInput = false;
    };
    window.addEventListener('keydown', noteKeyboard, true);
    window.addEventListener('pointerdown', notePointer, true);
    return () => {
      window.removeEventListener('keydown', noteKeyboard, true);
      window.removeEventListener('pointerdown', notePointer, true);
    };
  }, []);

  return (
    <Tooltip.Provider delayDuration={700} skipDelayDuration={300} disableHoverableContent>
      {children}
    </Tooltip.Provider>
  );
}

/**
 * A hint is never under the pointer, so one drawn over the next button can't block it.
 * Radix places the hint inside a wrapper of its own, which is what the pointer would hit.
 */
function letPointerThrough(content: HTMLDivElement | null) {
  content?.parentElement?.classList.add('pointer-events-none');
}

/** Marks every element with a hint, so one inside another can be told apart. */
const HINTED = 'data-app-tooltip';

interface AppTooltipProps {
  /** What the hint says. With nothing to say, the child renders on its own. */
  content: ReactNode;
  /** The element the hint belongs to; it must take a ref and pointer handlers. */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** The element is disabled: no hint, as a native one would give none. */
  disabled?: boolean;
  /**
   * For a long element, such as a resize handle the height of the window: the hint stays
   * level with the pointer as it moves along, not at the element's middle.
   */
  shouldFollowPointer?: boolean;
}

export function AppTooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  disabled = false,
  shouldFollowPointer = false,
}: AppTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pointerAlong, setPointerAlong] = useState(0);
  const [hintLength, setHintLength] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const isBeside = side === 'left' || side === 'right';
  // A disabled button stops hearing the pointer, so a hint showing when it was disabled
  // (the last Ctrl/⌘+Z under a hovered Undo) would never hear it leave. Close it here.
  if (disabled && open) setOpen(false);

  // A closing menu hands focus back to its ⋯ button, which would open a hint nobody asked
  // for. Only a pointer over the element, or focus moved by keyboard, asks for one.
  // A control inside the element with a hint of its own (the ⋯ in a bullet's text) speaks for
  // itself: the element's hint neither opens nor stays while the pointer is over it.
  const handleOpenChange = (next: boolean) => {
    const element = trigger.current;
    const isAsked =
      element !== null &&
      !element.querySelector(`[${HINTED}]:hover`) &&
      (element.matches(':hover') || (isKeyboardInput && element.matches(':focus')));
    setOpen(next && isAsked && !disabled);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(`[${HINTED}]`) !== event.currentTarget) {
      if (open) setOpen(false);
      return;
    }
    if (!shouldFollowPointer) return;
    const box = event.currentTarget.getBoundingClientRect();
    setPointerAlong(isBeside ? event.clientY - box.top : event.clientX - box.left);
  };

  if (content === undefined || content === null || content === '') return children;
  return (
    <Tooltip.Root open={open} onOpenChange={handleOpenChange}>
      <Tooltip.Trigger
        asChild
        ref={trigger}
        onPointerMove={handlePointerMove}
        {...{ [HINTED]: '' }}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          align={shouldFollowPointer ? 'start' : align}
          // Centred on the pointer: its place along the element, less half the hint.
          alignOffset={shouldFollowPointer ? pointerAlong - hintLength / 2 : 0}
          sideOffset={6}
          collisionPadding={8}
          ref={(node) => {
            letPointerThrough(node);
            if (node && shouldFollowPointer) {
              setHintLength(isBeside ? node.offsetHeight : node.offsetWidth);
            }
          }}
          className="z-50 max-w-72 rounded-md border border-line-strong bg-background px-2.5 py-1.5 text-support text-pretty text-foreground shadow-md animate-in fade-in-0 data-[state=closed]:animate-none"
        >
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
