import type { ComponentProps } from 'react';
import { CheckIcon } from 'lucide-react';
import { Checkbox } from 'radix-ui';
import { cn } from '@/lib/utils';

/*
 * Mosaic's checkbox, the design's `.chk`: a rounded square with a heavy edge that fills with
 * ink when checked. `sm` sits beside secondary text, as in lists and popovers.
 *
 * Built on Radix directly: shadcn's draws the check in Radix's indicator, which reads its
 * computed style as it mounts, and the editor mounts one for every bullet at once. The
 * check here is always there, hidden while unchecked.
 */

const SIZE_CLASSES = {
  md: 'size-[1.0625rem] rounded-[0.3125rem] [&_svg]:size-[0.6875rem]',
  sm: 'size-[0.9375rem] rounded-[0.25rem] [&_svg]:size-[0.5625rem]',
} as const;

type AppCheckboxProps = ComponentProps<typeof Checkbox.Root> & {
  size?: keyof typeof SIZE_CLASSES;
};

export function AppCheckbox({ size = 'md', className, ...props }: AppCheckboxProps) {
  return (
    <Checkbox.Root
      data-slot="checkbox"
      className={cn(
        'group/checkbox peer shrink-0 border-[1.5px] border-line-heavy shadow-none transition-[background-color,border-color] duration-120 outline-none hover:border-ink-muted focus-visible:border-ink-muted focus-visible:ring-3 focus-visible:ring-amber-soft disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background dark:bg-transparent dark:data-[state=checked]:bg-foreground [&_svg]:stroke-3',
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      <span className="grid place-content-center text-current group-data-[state=unchecked]/checkbox:hidden">
        <CheckIcon />
      </span>
    </Checkbox.Root>
  );
}
