import { RotateCcw, X } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { formatTimeOfDay } from '@shared/time/formatTime';
import { cn } from '@/lib/utils';

interface RunRecordProps {
  text: string;
  at: number;
  /** A Send again, rather than a stop. */
  isAgain?: boolean;
}

/** The quiet line a stop, or a Send again, leaves in its run, which stays after the notice goes. */
export function RunRecord({ text, at, isAgain = false }: RunRecordProps) {
  const Icon = isAgain ? RotateCcw : X;
  return (
    <Text as="p" variant="secondary" className="mt-2.25 flex items-start gap-1.75 first:mt-0">
      <span
        aria-hidden
        className={cn(
          'mt-0.75 grid size-3.25 shrink-0 place-items-center rounded-full border-[1.5px]',
          isAgain ? 'border-line-heavy text-ink-faint' : 'border-warn text-warn'
        )}
      >
        <Icon className="size-1.75" strokeWidth={isAgain ? 3 : 3.6} />
      </span>
      <span className="min-w-0 flex-1">{text}</span>
      <Text variant="meta" className="whitespace-nowrap">
        {formatTimeOfDay(at)}
      </Text>
    </Text>
  );
}
