import type { ComponentProps } from 'react';
import { FIELD_CLASSES } from './controlStyles';
import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  field: cn(FIELD_CLASSES, 'h-auto min-h-16 px-[0.5625rem] py-2'),
  // Inside a frame that draws the field, as the assistant's prompt box does: no border or
  // fill of its own, and the frame shows the focus.
  bare: 'bg-transparent text-body text-foreground outline-none placeholder:text-ink-faint selection:bg-amber-soft selection:text-foreground disabled:cursor-not-allowed',
} as const;

interface AppTextareaProps extends ComponentProps<'textarea'> {
  variant?: keyof typeof VARIANT_CLASSES;
}

/**
 * Mosaic's text area: the design's field, as tall as its text. A plain `<textarea>`, as
 * `AppInput` is a plain `<input>`.
 */
export function AppTextarea({ variant = 'field', className, ...props }: AppTextareaProps) {
  return (
    <textarea
      className={cn('field-sizing-content w-full resize-none', VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
