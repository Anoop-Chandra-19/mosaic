import { Lock, TriangleAlert } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { ProposalFlag } from '@/types/agentProposal';
import { describeFlag } from './describeFlag';
import { FLAG_LABELS } from '../../suggestionState';

/** What the checks noticed: a look in caution ink, the one that blocks on a tinted ground. */
export function SuggestionFlags({
  flags,
  isCompact = false,
}: {
  flags: readonly ProposalFlag[];
  isCompact?: boolean;
}) {
  if (!flags.length) return null;
  return (
    <div className={cn('flex flex-col gap-1.25', isCompact ? 'mt-1.5' : 'mt-2.5')}>
      {flags.map((flag) => {
        const isBlocking = flag.kind === 'unfilledGap';
        const Icon = isBlocking ? Lock : TriangleAlert;
        return (
          <div
            key={flag.kind}
            className={cn(
              'flex gap-1.75',
              isBlocking && 'rounded-sm border border-warn-line bg-warn-soft px-2.25 py-1.75'
            )}
          >
            <Icon className="mt-0.75 size-3 shrink-0 text-warn" />
            <Text variant="secondary" className="text-ink-soft">
              <b className="font-strong text-foreground">{FLAG_LABELS[flag.kind]}.</b>{' '}
              {describeFlag(flag)}
            </Text>
          </div>
        );
      })}
    </div>
  );
}
