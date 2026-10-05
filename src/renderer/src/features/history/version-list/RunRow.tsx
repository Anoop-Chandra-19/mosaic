import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { describeRunSections, formatTimeOfDay } from '../groupVersionHistory';
import { versionLabel } from '../useTemplateVersions';

type HeldKind = 'run' | 'fold';

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "9:12 AM to 11:40 AM" for a run within a day; "Aug 3 to Aug 28" for a fold of a month. */
function describeSpan(kind: HeldKind, oldest: VersionMeta, newest: VersionMeta): string {
  const format = kind === 'run' ? formatTimeOfDay : formatShortDate;
  const from = format(oldest.createdAt);
  const to = format(newest.createdAt);
  return from === to ? from : `${from} to ${to}`;
}

const TITLES: Record<HeldKind, (count: number) => string> = {
  run: (count) => `${count} snapshots while you worked`,
  fold: (count) => `${count} automatic snapshots`,
};

/** The rail thickens for the row: solid for a run, dotted for a fold, held rather than continuous. */
const RAIL_STRETCHES: Record<HeldKind, string> = {
  run: 'bg-line-heavy group-hover/held:bg-ink-faint',
  fold: 'bg-[repeating-linear-gradient(to_bottom,var(--line-heavy)_0_3px,transparent_3px_6px)] group-hover/held:bg-[repeating-linear-gradient(to_bottom,var(--ink-faint)_0_3px,transparent_3px_6px)]',
};

const OPEN_RAIL_STRETCHES: Record<HeldKind, string> = {
  run: 'bg-ink-faint',
  fold: 'bg-[repeating-linear-gradient(to_bottom,var(--ink-faint)_0_3px,transparent_3px_6px)]',
};

interface RunRowProps {
  kind: HeldKind;
  /** Newest first. */
  run: VersionMeta[];
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Rows held as one, opening in place: a run of plain editing, or old automatic snapshots
 * folded between two named versions.
 */
export function RunRow({ kind, run, isOpen, onToggle, children }: RunRowProps) {
  const newest = run[0];
  const oldest = run.at(-1)!;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    // Lets a reveal find the run that holds a version.
    <li data-version-ids={run.map((version) => version.id).join(' ')}>
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
            // Half a pixel back, onto the rail's centre, as the row marks are.
            'relative z-1 mx-[0.28125rem] -my-1.25 w-[0.1875rem] shrink-0 -translate-x-[0.03125rem] self-stretch',
            isOpen ? OPEN_RAIL_STRETCHES[kind] : RAIL_STRETCHES[kind]
          )}
        />
        <span className="min-w-0 flex-1">
          <Text
            variant="body"
            className={cn(
              'block',
              kind === 'run' && 'font-control',
              kind === 'run' || isOpen ? 'text-ink-soft' : 'text-ink-muted'
            )}
          >
            {TITLES[kind](run.length)}
          </Text>
          <Text variant="meta" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap">{describeSpan(kind, oldest, newest)}</span>
            <span className="whitespace-nowrap">
              {versionLabel(oldest)} to {versionLabel(newest)}
            </span>
            {kind === 'run' && <span className="text-ink-muted">{describeRunSections(run)}</span>}
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
