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
      className: 'bg-line text-ink-soft',
    },
    clean: {
      label: 'up to date',
      title: "Your draft matches the newest version in this template's history.",
      className: 'text-ink-faint',
    },
  };

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const badge = BADGES[status];
  if (!badge) return null;
  return (
    <AppTooltip content={badge.title}>
      <span
        className={cn(
          'inline-flex h-[1.1875rem] shrink-0 items-center rounded-[0.3125rem] border border-line-strong px-[0.4375rem] text-support font-strong tracking-[0.01em] whitespace-nowrap',
          badge.className
        )}
      >
        {badge.label}
      </span>
    </AppTooltip>
  );
}
