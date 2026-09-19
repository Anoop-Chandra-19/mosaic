import type { ComponentProps } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/**
 * The design's `.chk`: a heavy outline, filled with the ink colour when on. `small` is the
 * bullets' size; `dimmed` tones it down with a row that is left off the resume.
 */
export function EditorCheckbox({
  small = false,
  dimmed = false,
  className,
  ...props
}: ComponentProps<typeof Checkbox> & { small?: boolean; dimmed?: boolean }) {
  return (
    <Checkbox
      className={cn(
        'shrink-0 border-[1.5px] border-line-heavy bg-transparent shadow-none transition-colors hover:border-ink-muted data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background dark:bg-transparent dark:data-[state=checked]:bg-foreground [&_svg]:stroke-3',
        small
          ? 'size-[0.9375rem] rounded-[0.25rem] [&_svg]:size-[0.5625rem]'
          : 'size-[1.0625rem] rounded-[0.3125rem] [&_svg]:size-[0.6875rem]',
        dimmed &&
          'data-[state=checked]:border-ink-faint data-[state=checked]:bg-ink-faint dark:data-[state=checked]:bg-ink-faint [&_svg]:text-pane',
        className
      )}
      {...props}
    />
  );
}
