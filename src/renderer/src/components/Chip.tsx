import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * A small filled label with an optional icon, the design's `.chip`: a suggestion's kind, a
 * count of its parts. Amber marks the assistant's work waiting for review. `sm` sits inside
 * a row or beside a name: "off", "default", a long bullet's warning.
 */

const SIZE_CLASSES = {
  md: 'h-5.5 gap-1.25 rounded-md px-2 text-support',
  sm: 'h-4 gap-1 rounded-sm px-1.5 text-tag tracking-normal',
} as const;

const TONE_CLASSES = {
  neutral: 'border-line bg-line text-ink-soft',
  amber: 'border-amber-line bg-amber-soft text-amber',
  add: 'border-add-line bg-add-soft text-add',
  warn: 'border-warn-line bg-warn-soft text-warn',
} as const;

interface ChipProps extends ComponentProps<'span'> {
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}

export function Chip({ size = 'md', tone = 'neutral', className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border font-control whitespace-nowrap [&_svg:not([class*='size-'])]:size-2.5",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
