import { RotateCcw } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { useNow } from '@/lib/hooks/useNow';
import { foldAway } from '@/lib/motion/presenceMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { cn } from '@/lib/utils';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import type { RunRetry } from '@/stores/runStore';
import type { RunModel } from '@shared/types/agentConversation';
import { useChosenModel } from '../useChosenModel';
import { QuotedBlock } from './AgentNotice';
import { describeRetry, formatRetryCountdown, readSecondsLeft } from './retryWords';
import { useServerAddresses } from './useServerAddresses';

const COUNTDOWN_TICK_MS = 200;

/** Ticks on its own, so only this redraws. Hidden from screen readers, or each second is read out. */
function RetryCountdown({ retry }: { retry: RunRetry }) {
  const now = useNow(COUNTDOWN_TICK_MS);
  return (
    <span aria-hidden className="tabular-nums">
      {formatRetryCountdown(retry, readSecondsLeft(retry, now))}
    </span>
  );
}

/** A run with no message read yet has no stored model; the one Settings names is what it used. */
function useRetryModel(runModel: RunModel | null): RunModel {
  const provider = useAgentSettingsStore((s) => s.provider);
  const { model } = useChosenModel();
  return runModel ?? { provider, model };
}

interface RetryNoticeProps {
  retry: RunRetry | null;
  runModel: RunModel | null;
  /** Hangs from a boxed run line, so it shares that box's edge. */
  isAttached: boolean;
}

/**
 * Where the next step would appear while a request waits to go again: nothing to do, so it has
 * no dismiss or actions and leaves by itself when the reply resumes or the run stops.
 */
export function RetryNotice({ retry, runModel, isAttached }: RetryNoticeProps) {
  const { shown, isLeaving, ref } = usePresenceMotion(retry, retry && 'retry', foldAway);
  const model = useRetryModel(runModel);
  const serverAddresses = useServerAddresses();
  if (!shown) return null;
  const words = describeRetry(shown, model, serverAddresses);
  return (
    <div
      ref={ref}
      inert={isLeaving}
      aria-hidden={isLeaving || undefined}
      className={cn('overflow-hidden', isAttached && '-mt-2.75')}
    >
      <div
        role="status"
        aria-label={`${words.tag}. ${words.sentence}`}
        className={cn(
          'animate-notice-rise overflow-hidden rounded-[0.5625rem] border border-dashed border-warn-line pb-2.25 motion-reduce:animate-none',
          isAttached && 'rounded-t-none'
        )}
      >
        <div className="flex min-h-6.25 items-center gap-2 pt-1.75 pr-2.5 pl-2.5">
          <Text
            variant="tag"
            className="inline-flex h-4.5 shrink-0 items-center gap-1 rounded-[0.25rem] border border-dashed border-warn-line px-1.5 text-warn-text"
          >
            <RotateCcw className="size-2.5" strokeWidth={2.6} />
            {words.tag}
          </Text>
          <Text variant="meta" className="min-w-0 flex-1 truncate" title={words.who}>
            {words.who}
          </Text>
        </div>
        <Text as="p" variant="strong" className="px-2.5 pt-1.5 text-pretty">
          {words.sentence} <RetryCountdown retry={shown} />
        </Text>
        {words.quoted && <QuotedBlock quoted={words.quoted} />}
        {words.note && (
          <Text as="p" variant="secondary" className="mx-2.5 mt-1.5 text-pretty">
            {words.note}
          </Text>
        )}
        <Text as="p" variant="secondary" className="mx-2.5 mt-1.5 text-pretty">
          Nothing for you to do. Stop still works.
        </Text>
      </div>
    </div>
  );
}
