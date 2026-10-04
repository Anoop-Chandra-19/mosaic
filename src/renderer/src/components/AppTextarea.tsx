import type { ComponentProps } from 'react';
import { FIELD_CLASSES } from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/**
 * Mosaic's text area: the design's field, as tall as its text. A plain `<textarea>`, as
 * `AppInput` is a plain `<input>`.
 */
export function AppTextarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        FIELD_CLASSES,
        'field-sizing-content h-auto min-h-16 w-full resize-none px-[0.5625rem] py-2',
        className
      )}
      {...props}
    />
  );
}
