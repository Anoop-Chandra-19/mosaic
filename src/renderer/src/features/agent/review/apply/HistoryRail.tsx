import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import type { HistoryRow, HistoryRowLook } from './planHistoryRows';

/** Each row's mark on the rail, as the history list draws it: a tick, a square, a diamond. */
const MARKS: Record<HistoryRowLook, string> = {
  assistant: 'mx-[0.09375rem] mt-2.5 h-px w-2.25 bg-ink-muted',
  before:
    'mx-[0.15625rem] mt-1.5 size-1.75 rounded-[0.09375rem] bg-pane shadow-[inset_0_0_0_1.5px_var(--ink-faint),0_0_0_2px_var(--pane)]',
  named:
    'mx-0.5 mt-1.25 size-2 rotate-45 rounded-[0.0625rem] bg-foreground shadow-[0_0_0_2px_var(--pane-raised)]',
};

const SOURCES: Record<HistoryRowLook, string> = {
  assistant: 'assistant',
  before: 'before',
  named: 'named',
};

/** The rows Apply adds to history, on a small rail. */
export function HistoryRail({ rows }: { rows: HistoryRow[] }) {
  if (!rows.length) {
    return (
      <Text as="p" variant="secondary" className="text-ink-muted">
        Versions after the assistant’s edits are off, so history adds nothing. Undo still takes it
        back.
      </Text>
    );
  }
  return (
    <ol className="relative pl-0.5 before:absolute before:inset-y-1.5 before:left-1.5 before:w-px before:bg-line-strong">
      {rows.map((row) => (
        <li key={row.label} className="relative flex min-h-6.5 items-start gap-2 py-0.75">
          <i
            aria-hidden
            className={cn(
              'shrink-0',
              MARKS[row.look],
              row.look === 'named' &&
                row.isNew &&
                'shadow-[0_0_0_2px_var(--pane-raised),0_0_0_3.5px_var(--ink-faint)]'
            )}
          />
          <Text
            variant="meta"
            className={cn('mt-0.75 w-8.5 shrink-0', row.isNew ? 'text-ink-soft' : 'text-ink-faint')}
          >
            {row.label}
          </Text>
          <Text
            as="span"
            variant="secondary"
            className={cn(
              'min-w-0 flex-1',
              row.isNew ? 'text-foreground' : 'text-ink-faint',
              row.look === 'named' && 'font-strong'
            )}
          >
            {row.title}
            {row.sub && (
              <Text as="span" variant="caption" className="block font-regular">
                {row.sub}
              </Text>
            )}
          </Text>
          <Text
            variant="tag"
            className="mt-0.75 inline-flex h-3.5 items-center rounded-[0.25rem] border border-line-strong px-1"
          >
            {SOURCES[row.look]}
          </Text>
        </li>
      ))}
    </ol>
  );
}
