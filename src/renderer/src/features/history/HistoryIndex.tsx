import { Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { formatHistoryDay, listHistoryMonths } from './groupVersionHistory';

interface HistoryIndexProps {
  /** Newest first. */
  versions: VersionMeta[];
  selectedId: string | null;
  labelOf: (version: VersionMeta) => string;
  /** Asks the list to bring a version into view: never a scroll position. */
  onGoTo: (version: VersionMeta) => void;
}

/** The full view's table of contents: the named versions, then the months. */
export function HistoryIndex({ versions, selectedId, labelOf, onGoTo }: HistoryIndexProps) {
  const named = versions.filter((version) => version.kind === 'named');
  return (
    <nav
      aria-label="History index"
      className="w-51 shrink-0 overflow-auto border-r border-line bg-pane px-2.5 pt-2.5 pb-4.5"
    >
      <h3 className={EYEBROW}>Named versions</h3>
      {named.length === 0 && (
        <p className="mx-0.5 mb-1 text-[0.75rem] leading-normal text-ink-faint">
          None yet. Name a version to find it here.
        </p>
      )}
      {named.map((version) => (
        <AppButton
          key={version.id}
          variant="ghost"
          shape="text"
          aria-current={selectedId === version.id || undefined}
          onClick={() => onGoTo(version)}
          className={cn(
            'flex w-full items-start gap-2 px-1.75 py-1.5 text-[0.78125rem] leading-[1.35] text-ink-soft',
            selectedId === version.id &&
              'bg-amber-soft text-foreground shadow-[inset_0_0_0_1px_var(--color-amber-300)] hover:bg-amber-soft dark:shadow-[inset_0_0_0_1px_var(--color-amber-800)]'
          )}
        >
          <Save className="mt-0.5 size-2.75 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 flex-1">
            {version.summary}
            <span className="mt-0.5 block font-mono text-[0.6625rem] text-ink-faint">
              {labelOf(version)} · {formatHistoryDay(version.createdAt)}
            </span>
          </span>
        </AppButton>
      ))}
      <h3 className={cn(EYEBROW, 'mt-3.5')}>Months</h3>
      {listHistoryMonths(versions).map((month) => (
        <AppButton
          key={month.label}
          variant="ghost"
          shape="text"
          onClick={() => onGoTo(month.newest)}
          className="flex w-full justify-between px-1.75 py-1.5 font-mono text-[0.71875rem] text-ink-muted"
        >
          <span>{month.label}</span>
          <span className="text-[0.6625rem] text-ink-faint">{month.count.toLocaleString()}</span>
        </AppButton>
      ))}
    </nav>
  );
}

const EYEBROW =
  'mx-0.5 mt-1 mb-1.5 text-[0.65625rem] font-semibold tracking-[0.09em] text-ink-faint uppercase';
