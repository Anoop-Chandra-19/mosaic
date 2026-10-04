import type { ComponentProps } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppCollapsibleContent } from '@/components/AppCollapsible';
import { cn } from '@/lib/utils';

/** Clips with room to spare for an editor's ring and a row's hover fill. */
export function EditorFold({ className, ...props }: ComponentProps<typeof AppCollapsibleContent>) {
  return (
    <AppCollapsibleContent
      className={cn(
        'overflow-clip [overflow-clip-margin:0.375rem] duration-200 ease-settle data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  );
}

/** Turns with the fold instead of swapping icons. */
export function FoldChevron({ isOpen }: { isOpen: boolean }) {
  return (
    <ChevronRight
      className={cn(
        'size-3 transition-transform duration-200 ease-settle motion-reduce:transition-none',
        isOpen && 'rotate-90'
      )}
    />
  );
}
