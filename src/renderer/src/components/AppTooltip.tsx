import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
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

/** Once for the whole app: a hint waits half a second, then the next one follows at once. */
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
    <Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
      {children}
    </Tooltip.Provider>
  );
}

interface AppTooltipProps {
  /** What the hint says. With nothing to say, the child renders on its own. */
  content: ReactNode;
  /** The element the hint belongs to; it must take a ref and pointer handlers. */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** The element is disabled: no hint, as a native one would give none. */
  disabled?: boolean;
}

export function AppTooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  disabled = false,
}: AppTooltipProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // A disabled button stops hearing the pointer, so a hint showing when it was disabled
  // (the last Ctrl/⌘+Z under a hovered Undo) would never hear it leave. Close it here.
  if (disabled && open) setOpen(false);

  // A closing menu hands focus back to its ⋯ button, which would open a hint nobody asked
  // for. Only a pointer over the element, or focus moved by keyboard, asks for one.
  const handleOpenChange = (next: boolean) => {
    const element = trigger.current;
    const isAsked =
      element !== null &&
      (element.matches(':hover') || (isKeyboardInput && element.matches(':focus')));
    setOpen(next && isAsked && !disabled);
  };

  if (content === undefined || content === null || content === '') return children;
  return (
    <Tooltip.Root open={open} onOpenChange={handleOpenChange}>
      <Tooltip.Trigger asChild ref={trigger}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-72 rounded-md border border-line-strong bg-background px-2.5 py-1.5 text-xs leading-snug text-pretty text-foreground shadow-md animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
