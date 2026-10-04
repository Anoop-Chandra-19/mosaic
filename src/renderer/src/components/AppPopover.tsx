import type { ComponentProps } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FLOATING_SURFACE_CLASSES } from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/** Mosaic's popover: the shadcn popover on the same floating surface as menus. */

export const AppPopover = Popover;
export const AppPopoverTrigger = PopoverTrigger;

export function AppPopoverContent({ className, ...props }: ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      className={cn(FLOATING_SURFACE_CLASSES, 'p-3 text-body', className)}
      {...props}
    />
  );
}
