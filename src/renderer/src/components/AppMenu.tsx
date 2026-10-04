import type { ComponentProps } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FLOATING_SURFACE_CLASSES, LIST_ROW_CLASSES } from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/*
 * Mosaic's menu: the shadcn dropdown, drawn as the design's `.menu`. Rows are body text in
 * soft ink with 13px icons; a destructive row is red, and a checked row's mark sits in the
 * icon column, so its text lines up with the rows that have icons.
 */

export const AppMenu = DropdownMenu;
export const AppMenuTrigger = DropdownMenuTrigger;
export const AppMenuRadioGroup = DropdownMenuRadioGroup;

export function AppMenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      className={cn(FLOATING_SURFACE_CLASSES, 'p-[0.3125rem]', className)}
      {...props}
    />
  );
}

export function AppMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn(
        LIST_ROW_CLASSES,
        'data-[variant=destructive]:text-del data-[variant=destructive]:focus:bg-del-soft data-[variant=destructive]:focus:text-del dark:data-[variant=destructive]:focus:bg-del-soft data-[variant=destructive]:*:[svg]:!text-del',
        className
      )}
      {...props}
    />
  );
}

/** Text after the icon column, where the mark sits. */
const CHECKED_ROW_CLASSES = 'pl-[1.875rem]';

export function AppMenuCheckboxItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuCheckboxItem>) {
  return (
    <DropdownMenuCheckboxItem
      className={cn(
        LIST_ROW_CLASSES,
        CHECKED_ROW_CLASSES,
        '[&>span:first-child_svg]:size-[0.8125rem]',
        className
      )}
      {...props}
    />
  );
}

export function AppMenuRadioItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuRadioItem>) {
  return (
    <DropdownMenuRadioItem
      className={cn(LIST_ROW_CLASSES, CHECKED_ROW_CLASSES, className)}
      {...props}
    />
  );
}

/** A quiet heading over a group of rows, lined up with their text. */
export function AppMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      className={cn(
        'pt-[0.3125rem] pr-2.5 pb-[0.1875rem] pl-[1.9375rem] text-support text-ink-faint',
        className
      )}
      {...props}
    />
  );
}

export function AppMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuSeparator>) {
  return <DropdownMenuSeparator className={cn('mx-0.5 my-1 bg-line', className)} {...props} />;
}
