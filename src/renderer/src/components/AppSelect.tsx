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

/**
 * Radix puts focus back on the trigger once the list has finished closing, even if it has
 * since moved to another control: pick an option, click straight into the next field, and
 * the typing went nowhere while Enter opened the list again. Focus left on a container
 * (a dialog takes it while the list goes) still goes back to the trigger.
 */
function keepFocusMovedOn(event: Event) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.tabIndex >= 0) event.preventDefault();
}

export function AppSelectContent({
  className,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent
      className={cn(FLOATING_SURFACE_CLASSES, className)}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        keepFocusMovedOn(event);
      }}
      {...props}
    />
  );
}

export function AppSelectItem({ className, ...props }: ComponentProps<typeof SelectItem>) {
  return <SelectItem className={cn(LIST_ROW_CLASSES, 'pr-8', className)} {...props} />;
}
