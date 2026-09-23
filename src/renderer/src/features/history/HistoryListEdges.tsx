import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { formatHistoryMonth } from './groupVersionHistory';

/*
 * The lines at either end of a history list: how much there is above it, and what it
 * leaves out below it.
 */

interface HistoryCountProps {
  versions: VersionMeta[];
  isCompact: boolean;
  onOpenFullHistory?: () => void;
}

/** "2,041 versions · 12 named · since Oct 2025", once a history is long enough to need it. */
export function HistoryCount({ versions, isCompact, onOpenFullHistory }: HistoryCountProps) {
  const namedCount = versions.filter((version) => version.kind === 'named').length;
  return (
    <p
      className={cn(
        'mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint',
        isCompact ? 'mt-1.5' : 'mt-2.25'
      )}
    >
      <span>
        <b className="font-semibold text-ink-muted">{versions.length.toLocaleString()}</b> versions
      </span>
      <span aria-hidden>·</span>
      <span>
        <b className="font-semibold text-ink-muted">{namedCount.toLocaleString()}</b> named
      </span>
      <span aria-hidden>·</span>
      <span>since {formatHistoryMonth(versions.at(-1)!.createdAt)}</span>
      {onOpenFullHistory && (
        <>
          <span aria-hidden>·</span>
          <AppButton
            variant="link"
            onClick={onOpenFullHistory}
            className="h-auto p-0 font-mono text-[0.7rem] font-normal text-ink-muted underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-400"
          >
            full history
          </AppButton>
        </>
      )}
    </p>
  );
}

interface HistoryWindowEdgeProps {
  direction: 'newer' | 'earlier';
  count: number;
  /** Earlier only: how far back the rest goes. */
  oldestMonth?: string;
  onShow: () => void;
}

/** The full view's list is a window; each end says what lies past it, and reaches it. */
export function HistoryWindowEdge({
  direction,
  count,
  oldestMonth,
  onShow,
}: HistoryWindowEdgeProps) {
  const isNewer = direction === 'newer';
  const Chevron = isNewer ? ChevronUp : ChevronDown;
  return (
    <AppButton
      variant="dashed"
      size="xs"
      onClick={onShow}
      className={cn(
        'h-auto w-full flex-col items-start gap-0.5 rounded-sm border-line-strong px-2.5 py-2 text-ink-soft hover:border-line-heavy',
        isNewer ? 'mt-0.5 mb-2.5' : 'mt-2'
      )}
    >
      <span className="flex items-center gap-1.5">
        <Chevron className="size-3" />
        {isNewer ? 'Show newer' : 'Show earlier'}
      </span>
      <span className="font-mono text-[0.675rem] font-normal text-ink-faint">
        {isNewer
          ? `${count.toLocaleString()} newer ${count === 1 ? 'version' : 'versions'}, up to today.`
          : `${count.toLocaleString()} more, back to ${oldestMonth}`}
      </span>
    </AppButton>
  );
}

interface HistoryHandoffProps {
  label: string;
  hiddenCount: number;
  oldestMonth: string;
  isCompact: boolean;
  onOpenFullHistory?: () => void;
}

/** The one row that stands for every version the sidebar leaves out. */
export function HistoryHandoff({
  label,
  hiddenCount,
  oldestMonth,
  isCompact,
  onOpenFullHistory,
}: HistoryHandoffProps) {
  const rest = `${hiddenCount.toLocaleString()} earlier ${hiddenCount === 1 ? 'version' : 'versions'}, back to ${oldestMonth}.`;
  if (!onOpenFullHistory) {
    // Nothing to hand off to yet, so a peek says where the rest can be read.
    return (
      <p className="mt-2.5 mb-0.5 ml-5.5 font-mono text-[0.675rem] text-ink-faint">
        {rest} {isCompact ? 'Open the template to see them.' : 'All kept.'}
      </p>
    );
  }
  return (
    <AppButton
      variant="dashed"
      size="xs"
      onClick={onOpenFullHistory}
      className={cn(
        'h-auto w-full flex-col items-start gap-0.5 rounded-sm border-line-strong px-2.5 py-2 text-ink-soft hover:border-line-heavy',
        isCompact ? 'mt-1.5' : 'mt-2'
      )}
    >
      <span className="flex items-center gap-1.5">
        <ExternalLink className="size-3" />
        {label}
      </span>
      <span className="font-mono text-[0.675rem] font-normal text-ink-faint">{rest} All kept.</span>
    </AppButton>
  );
}
