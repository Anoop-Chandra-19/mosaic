import { cloneElement, useId, useLayoutEffect, type ReactElement, type ReactNode } from 'react';
import { Tooltip } from 'radix-ui';
import { HintLayer } from './HintLayer';
import { HINTED, hasHintContent, removeHint, setHint, type HintSide } from './hintRegistry';

/*
 * Mosaic's tooltip. A native `title` is drawn by Electron as a square-cornered box that no
 * style can reach, so every hint in the app goes through here instead: a rounded card in
 * the page's own surface, with no arrow, like the design's. `AppButton` takes a `title`
 * and shows it this way, so most hints never name this component.
 *
 * An `AppTooltip` only marks its element and says what its hint is; `HintLayer` shows it.
 * The editor alone has hundreds of hinted controls, and a tooltip each cost more to mount
 * than the controls did.
 */

/** Once for the whole app, around everything that has hints. */
export function AppTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider disableHoverableContent>
      {children}
      <HintLayer />
    </Tooltip.Provider>
  );
}

interface AppTooltipProps {
  /** What the hint says. With nothing to say, the child renders on its own. */
  content: ReactNode;
  /** The element the hint belongs to; it must pass a `data-` attribute on to its element. */
  children: ReactElement<{ [HINTED]?: string }>;
  side?: HintSide;
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
  const id = useId();
  useLayoutEffect(() => {
    setHint(id, { content, side, align, isDisabled: disabled, shouldFollowPointer });
  }, [id, content, side, align, disabled, shouldFollowPointer]);
  useLayoutEffect(() => () => removeHint(id), [id]);

  if (!hasHintContent(content)) return children;
  return cloneElement(children, { [HINTED]: id });
}
