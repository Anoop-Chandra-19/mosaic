import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import { describeRunSections, formatTimeOfDay } from './groupVersionHistory';

interface RunRowProps {
  /** Newest first. */
  run: VersionMeta[];
  labelOf: (version: VersionMeta) => string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A run of plain editing held as one row on a bead-stack dot; it opens in place. */
export function RunRow({ run, labelOf, isOpen, onToggle, children }: RunRowProps) {
  const newest = run[0];
  const oldest = run.at(-1)!;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <li>
      <AppButton
        variant="ghost"
        shape="text"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-start gap-2.5 px-0 py-1.25"
      >
        <span
          aria-hidden
          className="relative mt-1 ml-px size-2.75 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--line-heavy)] before:absolute before:-top-1.25 before:left-0.5 before:h-0.5 before:w-1.5 before:rounded-full before:bg-line-heavy after:absolute after:-bottom-1.25 after:left-0.5 after:h-0.5 after:w-1.5 after:rounded-full after:bg-line-heavy"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8rem] leading-[1.4] font-medium text-ink-soft">
            {run.length} snapshots while you worked
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint">
            <span className="whitespace-nowrap">
              {formatTimeOfDay(oldest.createdAt)} to {formatTimeOfDay(newest.createdAt)}
            </span>
            <span className="whitespace-nowrap">
              {labelOf(oldest)} to {labelOf(newest)}
            </span>
            <span className="text-ink-muted">{describeRunSections(run)}</span>
          </span>
        </span>
        <span
          className={cn(
            'rounded-[0.3125rem] border px-1.25 py-px font-mono text-[0.65625rem] whitespace-nowrap',
            isOpen ? 'border-line-heavy text-ink-soft' : 'border-line-strong text-ink-muted'
          )}
        >
          {isOpen ? 'hide' : 'open'}
        </span>
        <Chevron aria-hidden className="mt-1 size-3 text-ink-faint" />
      </AppButton>
      {isOpen && <ol className="mt-px mb-1.5 ml-5.25 border-l border-line pl-3">{children}</ol>}
    </li>
  );
}
