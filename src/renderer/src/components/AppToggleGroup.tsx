import { createContext, use, type ComponentProps } from 'react';
import { ToggleGroup } from 'radix-ui';
import { cn } from '@/lib/utils';

/*
 * Mosaic's segmented control, the design's `.seg`: options in a sunken strip, the chosen one
 * raised. `sm` fits inside a row or a popover. Built on Radix directly; shadcn's toggle
 * group draws separate buttons.
 *
 * The chosen option is styled by `aria-checked` (or `aria-pressed` for several at once), not
 * `data-state`: an `AppTooltip` around an option writes its own `data-state` over it.
 */

const SIZE_CLASSES = {
  md: { group: 'p-0.5', item: 'h-6 px-2.5' },
  sm: { group: 'p-px', item: 'h-5.5 px-2' },
} as const;

type ToggleGroupSize = keyof typeof SIZE_CLASSES;

const SizeContext = createContext<ToggleGroupSize>('md');

type AppToggleGroupProps = ComponentProps<typeof ToggleGroup.Root> & { size?: ToggleGroupSize };

export function AppToggleGroup({ size = 'md', className, ...props }: AppToggleGroupProps) {
  return (
    <SizeContext value={size}>
      <ToggleGroup.Root
        className={cn(
          'inline-flex w-fit items-center gap-0.5 rounded-sm border border-line bg-line',
          SIZE_CLASSES[size].group,
          className
        )}
        {...props}
      />
    </SizeContext>
  );
}

export function AppToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroup.Item>) {
  const size = use(SizeContext);
  return (
    <ToggleGroup.Item
      className={cn(
        'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[0.3125rem] text-support font-control whitespace-nowrap text-ink-muted transition-colors duration-120 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-amber-soft disabled:pointer-events-none disabled:opacity-50 aria-checked:bg-pane-raised aria-checked:text-foreground aria-checked:shadow-lifted aria-pressed:bg-pane-raised aria-pressed:text-foreground aria-pressed:shadow-lifted [&_svg]:shrink-0',
        SIZE_CLASSES[size].item,
        className
      )}
      {...props}
    />
  );
}
