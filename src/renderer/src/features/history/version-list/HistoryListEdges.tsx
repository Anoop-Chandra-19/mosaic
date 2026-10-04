import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { formatHistoryMonth } from '../groupVersionHistory';

/** A link set in the meta line it sits in. */
export const HISTORY_LINK =
  'h-auto p-0 font-mono text-meta font-regular text-ink-muted underline underline-offset-2 hover:text-amber';

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
    <Text
      as="p"
      variant="meta"
      className={cn(
        'mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1',
        isCompact ? 'mt-1.5' : 'mt-2.25'
      )}
    >
      <span>
        <b className="font-strong text-ink-muted">{versions.length.toLocaleString()}</b> versions
      </span>
      <span aria-hidden>·</span>
      <span>
        <b className="font-strong text-ink-muted">{namedCount.toLocaleString()}</b> named
      </span>
      <span aria-hidden>·</span>
      <span>since {formatHistoryMonth(versions.at(-1)!.createdAt)}</span>
      {onOpenFullHistory && (
        <>
          <span aria-hidden>·</span>
          <AppButton variant="link" onClick={onOpenFullHistory} className={HISTORY_LINK}>
            full history
          </AppButton>
        </>
      )}
    </Text>
  );
}

interface HistoryRangeEdgeProps {
  direction: 'newer' | 'earlier';
  count: number;
  /** Earlier only: how far back the rest goes. */
  oldestMonth?: string;
  onShow: () => void;
}

/** The full view's list is a range; each end says what lies past it, and reaches it. */
export function HistoryRangeEdge({ direction, count, oldestMonth, onShow }: HistoryRangeEdgeProps) {
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
      <Text variant="meta" className="text-left whitespace-normal">
        {isNewer
          ? `${count.toLocaleString()} newer ${count === 1 ? 'version' : 'versions'}, up to today.`
          : `${count.toLocaleString()} more, back to ${oldestMonth}`}
      </Text>
    </AppButton>
  );
}

interface HistoryHandoffProps {
  label: string;
  hiddenCount: number;
  oldestMonth: string;
  isCompact: boolean;
  onOpenFullHistory: () => void;
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
      <Text variant="meta" className="text-left whitespace-normal">
        {rest} All kept.
      </Text>
    </AppButton>
  );
}
