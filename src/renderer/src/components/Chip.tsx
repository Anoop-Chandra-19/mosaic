import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * A small filled label with an optional icon, the design's `.chip`: a suggestion's kind, a
 * count of its parts. Amber marks the assistant's work waiting for review.
 */

const TONE_CLASSES = {
  neutral: 'border-line bg-line text-ink-soft',
  amber: 'border-amber-line bg-amber-soft text-amber',
  add: 'border-add-line bg-add-soft text-add',
} as const;

interface ChipProps extends ComponentProps<'span'> {
  tone?: keyof typeof TONE_CLASSES;
}

export function Chip({ tone = 'neutral', className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1.25 rounded-md border px-2 text-support font-control whitespace-nowrap [&_svg:not([class*='size-'])]:size-2.5",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
