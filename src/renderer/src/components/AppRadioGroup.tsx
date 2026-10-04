import type { ComponentProps } from 'react';
import { Check } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { cn } from '@/lib/utils';

/*
 * Mosaic's radio group. An option's mark is the design's round `.chk`: a heavy ring that
 * fills amber with a check when chosen. Built on Radix directly, since the design's mark
 * differs from shadcn's dot.
 */

export function AppRadioGroup({ className, ...props }: ComponentProps<typeof RadioGroup.Root>) {
  return <RadioGroup.Root className={cn('grid gap-3', className)} {...props} />;
}

export function AppRadioGroupItem({ className, ...props }: ComponentProps<typeof RadioGroup.Item>) {
  return (
    <RadioGroup.Item
      className={cn(
        'grid size-[1.0625rem] shrink-0 place-items-center rounded-full border-[1.5px] border-line-heavy transition-[background-color,border-color] duration-120 outline-none hover:border-ink-muted focus-visible:border-ink-muted focus-visible:ring-3 focus-visible:ring-amber-soft disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-amber data-[state=checked]:bg-amber',
        className
      )}
      {...props}
    >
      <RadioGroup.Indicator asChild>
        <Check className="size-[0.5625rem] stroke-3 text-amber-ink" />
      </RadioGroup.Indicator>
    </RadioGroup.Item>
  );
}
