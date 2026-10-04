import type { ComponentProps } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FIELD_CLASSES,
  FLOATING_SURFACE_CLASSES,
  LIST_ROW_CLASSES,
} from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/*
 * Mosaic's select: the shadcn select, its trigger drawn as the design's field and its list
 * as the design's menu. One size; the caller sets the width.
 */

export const AppSelect = Select;
export const AppSelectValue = SelectValue;

export function AppSelectTrigger({
  className,
  ...props
}: Omit<ComponentProps<typeof SelectTrigger>, 'size'>) {
  return (
    <SelectTrigger
      className={cn(
        FIELD_CLASSES,
        "py-0 pr-2 data-[placeholder]:text-ink-faint data-[size=default]:h-8 dark:hover:bg-pane-sunken [&_svg:not([class*='text-'])]:text-ink-muted",
        className
      )}
      {...props}
    />
  );
}

export function AppSelectContent({ className, ...props }: ComponentProps<typeof SelectContent>) {
  return <SelectContent className={cn(FLOATING_SURFACE_CLASSES, className)} {...props} />;
}

export function AppSelectItem({ className, ...props }: ComponentProps<typeof SelectItem>) {
  return <SelectItem className={cn(LIST_ROW_CLASSES, 'pr-8', className)} {...props} />;
}
