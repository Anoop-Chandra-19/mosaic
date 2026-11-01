import type { ComponentProps } from 'react';
import { Tabs } from 'radix-ui';
import { cn } from '@/lib/utils';

/*
 * Mosaic's tabs, the design's `.panetab`: equal tabs side by side, the chosen one in full ink.
 * What marks the chosen tab's place (a raised panel that slides between them) belongs to the
 * list that draws it. `folder` is the design's `.s-tabs`: tabs that hang from the view they
 * switch, the chosen one outlined and open at its foot, over the rule under them. Built on Radix
 * directly; shadcn's tabs draw a pill and an underline.
 */

type TabsVariant = 'equal' | 'folder';

const LIST_VARIANTS: Record<TabsVariant, string> = {
  equal: 'items-center',
  folder: 'min-h-7 items-end gap-0.5 border-b border-line px-2',
};

const TRIGGER_VARIANTS: Record<TabsVariant, string> = {
  equal:
    'h-[1.9375rem] flex-1 gap-[0.4375rem] rounded-sm text-body font-control data-[state=active]:hover:bg-transparent',
  folder:
    '-mb-px h-6.75 flex-none gap-1.5 rounded-t-md border border-b-0 border-transparent px-2.25 text-support font-regular data-[state=active]:border-line data-[state=active]:bg-pane data-[state=active]:font-strong data-[state=active]:hover:bg-pane',
};

export function AppTabs({ className, ...props }: ComponentProps<typeof Tabs.Root>) {
  return <Tabs.Root className={cn('flex flex-col', className)} {...props} />;
}

export function AppTabsList({
  variant = 'equal',
  className,
  ...props
}: ComponentProps<typeof Tabs.List> & { variant?: TabsVariant }) {
  return <Tabs.List className={cn('flex', LIST_VARIANTS[variant], className)} {...props} />;
}

export function AppTabsTrigger({
  variant = 'equal',
  className,
  ...props
}: ComponentProps<typeof Tabs.Trigger> & { variant?: TabsVariant }) {
  return (
    <Tabs.Trigger
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap text-ink-muted transition-colors outline-none hover:bg-line hover:text-ink-soft focus-visible:ring-3 focus-visible:ring-amber-soft data-[state=active]:text-foreground [&_svg]:shrink-0',
        TRIGGER_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export function AppTabsContent({ className, ...props }: ComponentProps<typeof Tabs.Content>) {
  return <Tabs.Content className={cn('flex-1 outline-none', className)} {...props} />;
}
