import type { ComponentProps, ReactNode } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { LIST_ROW_CLASSES } from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/*
 * Mosaic's command list: a search field over a list moved through with the arrow keys and
 * chosen with Enter, the shadcn command (cmdk) drawn as the design's palette (`.dt-field`,
 * `.dt-gh`, `.dt-row`). What matches is the caller's to decide (`shouldFilter` is off), so
 * the list shows exactly the rows it is given, in their order.
 */

export function AppCommand({ className, ...props }: ComponentProps<typeof Command>) {
  return (
    <Command
      shouldFilter={false}
      loop
      className={cn('rounded-none bg-transparent text-ink-soft', className)}
      {...props}
    />
  );
}

/**
 * The field across the top: its search icon first, or `leading` in its place (the choices
 * made so far), and `trailing` at its end.
 */
export function AppCommandInput({
  className,
  leading,
  trailing,
  ...props
}: ComponentProps<typeof CommandInput> & { leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <div
      className={cn(
        'flex min-h-12 flex-wrap items-center gap-1.25 border-b border-line pr-3 *:data-[slot=command-input-wrapper]:h-12 *:data-[slot=command-input-wrapper]:min-w-35 *:data-[slot=command-input-wrapper]:flex-1 *:data-[slot=command-input-wrapper]:gap-2 *:data-[slot=command-input-wrapper]:border-0 *:data-[slot=command-input-wrapper]:pr-0 [&>[data-slot=command-input-wrapper]>svg]:size-3.5 [&>[data-slot=command-input-wrapper]>svg]:text-ink-faint [&>[data-slot=command-input-wrapper]>svg]:opacity-100',
        leading &&
          'py-2.25 pl-3 *:data-[slot=command-input-wrapper]:h-7 *:data-[slot=command-input-wrapper]:pl-0.5 [&>[data-slot=command-input-wrapper]>svg]:hidden'
      )}
    >
      {leading}
      <CommandInput
        className={cn(
          'h-7 py-0 text-title font-regular text-foreground placeholder:text-ink-faint',
          className
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

export function AppCommandList({ className, ...props }: ComponentProps<typeof CommandList>) {
  return (
    <CommandList
      className={cn('max-h-none min-h-0 flex-1 scroll-py-1 px-1.5 pt-1 pb-1.5', className)}
      {...props}
    />
  );
}

/** A group under its eyebrow heading; a `heading` with more than words lays them out in a row. */
export function AppCommandGroup({ className, ...props }: ComponentProps<typeof CommandGroup>) {
  return (
    <CommandGroup
      className={cn(
        'p-0 text-ink-soft [&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.25 [&_[cmdk-group-heading]]:pb-0.75 [&_[cmdk-group-heading]]:text-eyebrow [&_[cmdk-group-heading]]:text-ink-faint [&_[cmdk-group-heading]]:uppercase',
        className
      )}
      {...props}
    />
  );
}

/** A row. The chosen one is drawn as the menu's hovered row; the pointer chooses too. */
export function AppCommandItem({ className, ...props }: ComponentProps<typeof CommandItem>) {
  return (
    <CommandItem
      className={cn(
        LIST_ROW_CLASSES,
        'group min-h-7.5 py-1.25 data-[selected=true]:bg-line data-[selected=true]:text-foreground',
        className
      )}
      {...props}
    />
  );
}

/** What the list says when nothing is in it. */
export function AppCommandEmpty({ className, ...props }: ComponentProps<typeof CommandEmpty>) {
  return (
    <CommandEmpty
      className={cn('px-2 pt-1.5 pb-1 text-left text-support text-ink-faint', className)}
      {...props}
    />
  );
}
