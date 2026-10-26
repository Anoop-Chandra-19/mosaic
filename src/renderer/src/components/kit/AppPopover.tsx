import type { ComponentProps } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FLOATING_SURFACE_CLASSES } from './controlStyles';
import { cn } from '@/lib/utils';

/** Mosaic's popover: the shadcn popover on the same floating surface as menus. */

export const AppPopover = Popover;
export const AppPopoverTrigger = PopoverTrigger;
/** Places the popover by an element that doesn't open it, such as one shown on hover. */
export const AppPopoverAnchor = PopoverAnchor;

/**
 * `shouldHoldScroll`: while open, the wheel scrolls only what is inside, as in a select. A list
 * that scrolls needs it inside a modal dialog, which otherwise refuses the wheel to anything
 * drawn outside it, as a popover is.
 */
export function AppPopoverContent({
  className,
  shouldHoldScroll = false,
  children,
  ...props
}: ComponentProps<typeof PopoverContent> & { shouldHoldScroll?: boolean }) {
  return (
    <PopoverContent className={cn(FLOATING_SURFACE_CLASSES, 'p-3 text-body', className)} {...props}>
      {shouldHoldScroll ? (
        <RemoveScroll allowPinchZoom className="contents">
          {children}
        </RemoveScroll>
      ) : (
        children
      )}
    </PopoverContent>
  );
}
