import type { TemplateStatus } from '@/lib/hooks/useTemplateStatus';

const STATUS_STYLES: Record<TemplateStatus, string> = {
  clean: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  modified: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  untracked: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400',
};

const STATUS_LABELS: Record<TemplateStatus, string> = {
  clean: 'clean',
  modified: 'modified',
  untracked: 'untracked',
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
