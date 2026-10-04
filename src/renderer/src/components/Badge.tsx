import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * A small bordered label for a state: "edited", "not on resume", "no text". One look at two
 * sizes: `md` beside a title (the design's `.badge`), `sm` inside a row (`.htag`). A filled
 * badge is something to notice; a plain one only says how things are.
 */

const SIZE_CLASSES = {
  md: 'h-[1.1875rem] px-[0.4375rem] text-support',
  sm: 'h-4 px-1.25 text-meta',
} as const;

const TONE_CLASSES = {
  filled: 'bg-line text-ink-soft',
  plain: 'text-ink-faint',
} as const;

interface BadgeProps extends ComponentProps<'span'> {
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}

export function Badge({ size = 'md', tone = 'plain', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-[0.3125rem] border border-line-strong font-sans font-strong tracking-[0.02em] whitespace-nowrap',
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
