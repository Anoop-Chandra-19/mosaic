import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { versionLabel } from '../versionLabel';

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "Aug 3 to Aug 28" for a fold of a month. */
function describeSpan(oldest: VersionMeta, newest: VersionMeta): string {
  const from = formatShortDate(oldest.createdAt);
  const to = formatShortDate(newest.createdAt);
  return from === to ? from : `${from} to ${to}`;
}

interface FoldRowProps {
  /** The newest revision of each number it holds, newest first. */
  numbers: VersionMeta[];
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Old automatic snapshots folded between two named versions, opening in place. The rail
 * thickens for the row, dotted, so it reads as held rather than continuous.
 */
export function FoldRow({ numbers, isOpen, onToggle, children }: FoldRowProps) {
  const newest = numbers[0];
  const oldest = numbers.at(-1)!;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    // Lets a reveal find the fold that holds a version.
    <li data-version-ids={numbers.map((version) => version.id).join(' ')}>
      <AppButton
        variant="ghost"
        shape="text"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="group/held flex w-full items-start gap-2.5 px-0 py-1.25"
      >
        <span
          aria-hidden
          className={cn(
            // Centred on the rail in whole pixels, as the row marks are.
            'relative z-1 -my-1.25 mr-1.25 ml-1 w-0.75 shrink-0 self-stretch',
            isOpen
              ? 'bg-[repeating-linear-gradient(to_bottom,var(--ink-faint)_0_3px,transparent_3px_6px)]'
              : 'bg-[repeating-linear-gradient(to_bottom,var(--line-heavy)_0_3px,transparent_3px_6px)] group-hover/held:bg-[repeating-linear-gradient(to_bottom,var(--ink-faint)_0_3px,transparent_3px_6px)]'
          )}
        />
        <span className="min-w-0 flex-1">
          <Text variant="body" className={cn('block', isOpen ? 'text-ink-soft' : 'text-ink-muted')}>
            {numbers.length} automatic snapshots
          </Text>
          <Text variant="meta" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap">{describeSpan(oldest, newest)}</span>
            <span className="whitespace-nowrap">
              {versionLabel(oldest)} to {versionLabel(newest)}
            </span>
          </Text>
        </span>
        <Text
          variant="meta"
          className={cn(
            'rounded-[0.3125rem] border px-1.25 py-px whitespace-nowrap',
            isOpen ? 'border-line-heavy text-ink-soft' : 'border-line-strong text-ink-muted'
          )}
        >
          {isOpen ? 'hide' : 'open'}
        </Text>
        <Chevron aria-hidden className="mt-1 size-3 text-ink-faint" />
      </AppButton>
      {isOpen && <ol className="mt-px mb-1.5 ml-5.25 border-l border-line pl-3">{children}</ol>}
    </li>
  );
}
