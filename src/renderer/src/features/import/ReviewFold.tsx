import type { ComponentProps } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppCollapsibleContent } from '@/components/AppCollapsible';
import { cn } from '@/lib/utils';

/** Turns with the open state of the nearest `group/row`. */
export function RowCaret() {
  return (
    <ChevronRight className="size-3 shrink-0 text-ink-faint transition-transform duration-120 group-data-[state=open]/row:rotate-90 motion-reduce:transition-none" />
  );
}

export function ReviewFold({ className, ...props }: ComponentProps<typeof AppCollapsibleContent>) {
  return (
    <AppCollapsibleContent
      className={cn(
        'overflow-hidden duration-180 ease-settle data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  );
}
