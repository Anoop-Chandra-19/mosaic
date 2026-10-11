import type { ComponentProps } from 'react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FLOATING_SURFACE_CLASSES } from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/** Mosaic's popover: the shadcn popover on the same floating surface as menus. */

export const AppPopover = Popover;
export const AppPopoverTrigger = PopoverTrigger;
/** Places the popover by an element that doesn't open it, such as one shown on hover. */
export const AppPopoverAnchor = PopoverAnchor;

export function AppPopoverContent({ className, ...props }: ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      className={cn(FLOATING_SURFACE_CLASSES, 'p-3 text-body', className)}
      {...props}
    />
  );
}
