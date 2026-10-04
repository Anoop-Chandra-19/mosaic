import type { ComponentProps } from 'react';
import { FIELD_CLASSES } from '@/components/controlStyles';
import { cn } from '@/lib/utils';

/**
 * Mosaic's text field, the design's `.input`. A plain `<input>`: shadcn's adds only classes,
 * and its own font sizes would outrank a caller's.
 */
export function AppInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(FIELD_CLASSES, 'w-full min-w-0', className)} {...props} />;
}
