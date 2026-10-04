import type { ComponentProps } from 'react';
import { AppCheckbox } from '@/components/AppCheckbox';
import { cn } from '@/lib/utils';

/**
 * The editor's checkbox: `small` is the bullets' size; `dimmed` tones it down with a row that
 * is left off the resume.
 */
export function EditorCheckbox({
  small = false,
  dimmed = false,
  className,
  ...props
}: Omit<ComponentProps<typeof AppCheckbox>, 'size'> & { small?: boolean; dimmed?: boolean }) {
  return (
    <AppCheckbox
      size={small ? 'sm' : 'md'}
      className={cn(
        dimmed &&
          'data-[state=checked]:border-ink-faint data-[state=checked]:bg-ink-faint dark:data-[state=checked]:bg-ink-faint [&_svg]:text-pane',
        className
      )}
      {...props}
    />
  );
}
