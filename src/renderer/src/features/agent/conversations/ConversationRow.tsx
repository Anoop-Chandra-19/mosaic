import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@shared/types/agentBridge';
import { describeStop } from '../notices/stopWords';
import { useServerAddresses } from '../notices/useServerAddresses';
import { TracingDots } from '../reply/TracingDots';
import { formatLastActive, formatResumeNames, UNTITLED } from './conversationListWords';

/** Marks a row's button, for the list's arrow keys. */
export const ROW_ATTRIBUTE = 'data-conversation-row';

export const ROW_GRID =
  'grid h-auto w-full grid-cols-[0.875rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0.5 rounded-sm py-1.75 pr-2 pl-1 text-left font-regular whitespace-normal';

const CURRENT_ROW =
  'relative bg-pane-raised ring-1 ring-line-strong ring-inset before:absolute before:inset-y-2.25 before:-left-1.5 before:w-0.5 before:rounded-full before:bg-foreground';

const TITLE = 'line-clamp-2 wrap-anywhere text-pretty @min-[30rem]/list:line-clamp-3';

interface ConversationRowProps {
  conversation: ConversationSummary;
  isCurrent: boolean;
  isRunning: boolean;
  failure: string | null;
  onOpen: () => void;
}

/** One conversation: its first words, when it was last active, its resumes, and what needs you. */
export function ConversationRow({
  conversation,
  isCurrent,
  isRunning,
  failure,
  onOpen,
}: ConversationRowProps) {
  const serverAddresses = useServerAddresses();
  const { title, resumes, stop, lastActiveAt } = conversation;
  const stopWords =
    !isRunning && stop ? describeStop(stop.body, stop.runModel, serverAddresses) : null;

  return (
    <div role="listitem" className="mt-px">
      <AppButton
        variant="plain"
        {...{ [ROW_ATTRIBUTE]: true }}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={onOpen}
        className={cn(ROW_GRID, 'hover:bg-line', isCurrent && CURRENT_ROW)}
      >
        <span aria-hidden className="flex justify-center pt-0.75">
          {isRunning && <TracingDots tone="muted" />}
          {stopWords && <span className="mt-0.75 size-1.5 rounded-full bg-warn" />}
        </span>
        <Text
          variant={isCurrent ? 'strong' : 'body'}
          className={cn(TITLE, title === null && 'text-ink-muted')}
        >
          {title ?? UNTITLED}
        </Text>
        <Text variant="meta" className={isRunning ? 'text-ink-soft' : 'text-ink-faint'}>
          {isRunning ? 'Now' : formatLastActive(lastActiveAt)}
        </Text>
        {(isRunning || stopWords || resumes.length > 0) && (
          <span className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.75">
            {isRunning && (
              <Text variant="secondary" className="font-control text-ink-soft">
                Running now
              </Text>
            )}
            {stopWords && (
              <Text variant="secondary" className="font-control text-warn">
                Stopped: {stopWords.record}
              </Text>
            )}
            {resumes.length > 0 && (
              <Text
                variant="secondary"
                title={resumes.join(', ')}
                className="max-w-full truncate text-ink-muted"
              >
                {formatResumeNames(resumes)}
              </Text>
            )}
          </span>
        )}
      </AppButton>
      {failure && (
        <Text
          as="p"
          role="alert"
          variant="secondary"
          className="px-2 pt-0.5 pb-2 pl-6.5 text-ink-soft"
        >
          {failure}
        </Text>
      )}
    </div>
  );
}
