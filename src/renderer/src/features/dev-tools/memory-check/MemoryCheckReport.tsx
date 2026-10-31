import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AppButton, Text, textVariantClasses } from '@/components/ui-kit';
import { ShortcutKeys } from '@/components/ShortcutKeys';
import { cn } from '@/lib/utils';
import {
  formatCheckTime,
  formatMemoryChange,
  formatMemoryCheckText,
  runMemoryCheck,
  type MemoryCheck,
  type MemoryRow,
} from './runMemoryCheck';

const NUMBER_CELL = cn(textVariantClasses('meta'), 'border-t border-line py-1.25 text-right');

function MemoryTableRow({ row, isTotal }: { row: MemoryRow; isTotal?: boolean }) {
  return (
    <tr className={cn(isTotal && 'font-strong')}>
      <td
        className={cn(
          'border-t border-line py-1.25',
          isTotal ? 'text-foreground' : 'text-ink-soft'
        )}
      >
        {row.name}
        {row.isUtility && (
          <Text variant="meta" className="ml-1.5 text-ink-faint">
            utility
          </Text>
        )}
      </td>
      <td className={cn(NUMBER_CELL, 'text-foreground')}>{row.megabytes} MB</td>
      <td className={cn(NUMBER_CELL, 'w-17.5 text-ink-faint', isTotal && 'text-foreground')}>
        {formatMemoryChange(row.change)}
      </td>
    </tr>
  );
}

interface MemoryCheckReportProps {
  onRunAgain: () => void;
}

/** One check, taken as it mounts: the palette mounts it afresh to run it again. */
export function MemoryCheckReport({ onRunAgain }: MemoryCheckReportProps) {
  const [check, setCheck] = useState<MemoryCheck | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  useEffect(() => {
    void runMemoryCheck().then(setCheck);
  }, []);

  if (!check) return null;
  const copy = () => {
    void navigator.clipboard.writeText(formatMemoryCheckText(check)).then(() => setIsCopied(true));
  };
  const since = check.since ? `, change since ${formatCheckTime(check.since)}` : '';
  return (
    <div
      role="region"
      aria-label="Memory check"
      className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-1.5 pb-3"
    >
      <div className="flex items-baseline gap-2.5 pt-1.5 pb-2">
        <Text as="h2" variant="title" className="shrink-0">
          Memory check
        </Text>
        <Text variant="meta" className="min-w-0 text-ink-faint">
          per process, as Electron reports it · {formatCheckTime(check.takenAt)}
          {since}
        </Text>
      </div>
      <table className={cn(textVariantClasses('body'), 'w-full border-collapse')}>
        <tbody>
          {check.rows.map((row) => (
            <MemoryTableRow key={row.name} row={row} />
          ))}
          <MemoryTableRow row={check.total} isTotal />
        </tbody>
      </table>
      <div className="mt-2.5 flex gap-1.5">
        <AppButton variant="outline" size="xs" onClick={onRunAgain}>
          Run again
          <ShortcutKeys combos={['Enter']} />
        </AppButton>
        <AppButton variant="ghost" size="xs" onClick={copy}>
          {isCopied && <Check />}
          {isCopied ? 'Copied' : 'Copy as text'}
        </AppButton>
      </div>
    </div>
  );
}
