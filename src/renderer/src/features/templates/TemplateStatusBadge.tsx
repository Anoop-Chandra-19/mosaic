import { AppTooltip } from '@/components/AppTooltip';
import { cn } from '@/lib/utils';
import type { TemplateStatus } from './useTemplateStatus';

// Neutral on purpose: amber is kept for the assistant's pending suggestions, and the
// document's own state never competes with it.
const BADGES: Partial<Record<TemplateStatus, { label: string; title: string; className: string }>> =
  {
    edited: {
      label: 'edited',
      title: 'Saved as you type. Name a version when you want to find this state again.',
      className: 'border-line-strong bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    clean: {
      label: 'up to date',
      title: "The draft matches the newest version in this template's history.",
      className: 'border-line-strong text-zinc-500 dark:text-zinc-500',
    },
  };

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const badge = BADGES[status];
  if (!badge) return null;
  return (
    <AppTooltip content={badge.title}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold',
          badge.className
        )}
      >
        {badge.label}
      </span>
    </AppTooltip>
  );
}
