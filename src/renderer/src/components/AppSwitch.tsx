import type { ComponentProps } from 'react';
import { Switch } from 'radix-ui';
import { cn } from '@/lib/utils';

/*
 * Mosaic's switch, the design's `.switch`: a grey track that turns amber, with a knob that
 * darkens as it slides across. Built on Radix directly, since the design's knob differs
 * from shadcn's.
 */
export function AppSwitch({ className, ...props }: ComponentProps<typeof Switch.Root>) {
  return (
    <Switch.Root
      className={cn(
        'peer inline-flex h-[1.125rem] w-8 shrink-0 items-center rounded-full bg-line-strong px-0.5 transition-colors duration-160 outline-none focus-visible:ring-3 focus-visible:ring-amber-soft disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-amber motion-reduce:transition-none',
        className
      )}
      {...props}
    >
      <Switch.Thumb className="pointer-events-none block size-3.5 rounded-full bg-ink-soft transition-[translate,background-color] duration-160 data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-amber-ink motion-reduce:transition-none" />
    </Switch.Root>
  );
}
