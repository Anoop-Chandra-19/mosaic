import type { ComponentProps } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/*
 * Mosaic's checkbox, the design's `.chk`: a rounded square with a heavy edge that fills with
 * ink when checked. `sm` sits beside secondary text, as in lists and popovers.
 */

const SIZE_CLASSES = {
  md: 'size-[1.0625rem] rounded-[0.3125rem] [&_svg]:size-[0.6875rem]',
  sm: 'size-[0.9375rem] rounded-[0.25rem] [&_svg]:size-[0.5625rem]',
} as const;

type AppCheckboxProps = ComponentProps<typeof Checkbox> & { size?: keyof typeof SIZE_CLASSES };

export function AppCheckbox({ size = 'md', className, ...props }: AppCheckboxProps) {
  return (
    <Checkbox
      className={cn(
        'border-[1.5px] border-line-heavy shadow-none transition-[background-color,border-color] duration-120 hover:border-ink-muted focus-visible:border-ink-muted focus-visible:ring-3 focus-visible:ring-amber-soft data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background dark:bg-transparent dark:data-[state=checked]:bg-foreground [&_svg]:stroke-3',
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}
