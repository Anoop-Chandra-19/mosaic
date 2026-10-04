import type { ComponentProps } from 'react';
import { Tabs } from 'radix-ui';
import { cn } from '@/lib/utils';

/*
 * Mosaic's tabs, the design's `.panetab`: equal tabs side by side, the chosen one in full ink.
 * What marks the chosen tab's place (a raised panel that slides between them) belongs to the
 * list that draws it. Built on Radix directly; shadcn's tabs draw a pill and an underline.
 */

export function AppTabs({ className, ...props }: ComponentProps<typeof Tabs.Root>) {
  return <Tabs.Root className={cn('flex flex-col', className)} {...props} />;
}

export function AppTabsList({ className, ...props }: ComponentProps<typeof Tabs.List>) {
  return <Tabs.List className={cn('flex items-center', className)} {...props} />;
}

export function AppTabsTrigger({ className, ...props }: ComponentProps<typeof Tabs.Trigger>) {
  return (
    <Tabs.Trigger
      className={cn(
        'relative inline-flex h-[1.9375rem] flex-1 items-center justify-center gap-[0.4375rem] rounded-sm text-body font-control whitespace-nowrap text-ink-muted transition-colors outline-none hover:bg-line hover:text-ink-soft focus-visible:ring-3 focus-visible:ring-amber-soft data-[state=active]:text-foreground data-[state=active]:hover:bg-transparent [&_svg]:shrink-0',
        className
      )}
      {...props}
    />
  );
}

export function AppTabsContent({ className, ...props }: ComponentProps<typeof Tabs.Content>) {
  return <Tabs.Content className={cn('flex-1 outline-none', className)} {...props} />;
}
