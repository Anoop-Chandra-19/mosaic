import { useRef, useState, type KeyboardEvent } from 'react';
import { ChevronRight, Ellipsis, Square, Trash2 } from 'lucide-react';
import {
  AppButton,
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
  Text,
} from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@shared/types/agentBridge';
import { describeStop } from '../notices/stopWords';
import { useServerAddresses } from '../notices/useServerAddresses';
import { TracingDots } from '../reply/TracingDots';
import { ConversationDeleteConfirm } from './ConversationDeleteConfirm';
import {
  formatLastActive,
  formatResumeNames,
  pickDeleteCase,
  UNTITLED,
} from './conversationListWords';

/** Marks a row's button, for the list's arrow keys. */
export const ROW_ATTRIBUTE = 'data-conversation-row';
/** Marks what moves as the list changes: a row whole, with its question or its failure. */
export const LIST_MOTION_ATTRIBUTE = 'data-conversation-place';

export const ROW_GRID =
  'grid h-auto w-full grid-cols-[0.875rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0.5 rounded-sm py-1.75 pr-2 pl-1 text-left font-regular whitespace-normal';

const CURRENT_ROW =
  'relative bg-pane-raised ring-1 ring-line-strong ring-inset before:absolute before:inset-y-2.25 before:-left-1.5 before:w-0.5 before:rounded-full before:bg-foreground';

const TITLE = 'line-clamp-2 wrap-anywhere text-pretty @min-[30rem]/list:line-clamp-3';

/** ⋯ takes the time's place while the row has the pointer or the keyboard, or its menu is open. */
const SHOWN_WITH_ROW = 'invisible group-hover:visible group-focus-within:visible';
const HIDDEN_WITH_ROW = 'group-hover:invisible group-focus-within:invisible';

export interface RowFailure {
  words: string;
  onTryAgain: () => void;
}

interface ConversationRowProps {
  conversation: ConversationSummary;
  isCurrent: boolean;
  isRunning: boolean;
  isConfirming: boolean;
  isDeleting: boolean;
  failure: RowFailure | null;
  onOpen: () => void;
  onStop: () => void;
  onAskDelete: () => void;
  onDelete: () => void;
  onKeep: () => void;
}

/** One conversation: its first words, when it was last active, its resumes, and what needs you. */
export function ConversationRow({
  conversation,
  isCurrent,
  isRunning,
  isConfirming,
  isDeleting,
  failure,
  onOpen,
  onStop,
  onAskDelete,
  onDelete,
  onKeep,
}: ConversationRowProps) {
  const serverAddresses = useServerAddresses();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const { id, title, resumes, stop, lastActiveAt } = conversation;
  const stopWords =
    !isRunning && stop ? describeStop(stop.body, stop.runModel, serverAddresses) : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onAskDelete();
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      setIsMenuOpen(true);
    }
  };

  if (isConfirming) {
    return (
      <div role="listitem" className="mt-px" {...{ [LIST_MOTION_ATTRIBUTE]: id }}>
        <ConversationDeleteConfirm
          title={title}
          deleteCase={pickDeleteCase(isCurrent, isRunning)}
          isDeleting={isDeleting}
          onDelete={onDelete}
          onKeep={onKeep}
        />
      </div>
    );
  }

  return (
    <div role="listitem" className="group relative mt-px" {...{ [LIST_MOTION_ATTRIBUTE]: id }}>
      <AppButton
        ref={rowRef}
        variant="plain"
        {...{ [ROW_ATTRIBUTE]: id }}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={onOpen}
        onKeyDown={handleKeyDown}
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
        <Text
          variant="meta"
          className={cn(
            isRunning ? 'text-ink-soft' : 'text-ink-faint',
            isMenuOpen ? 'invisible' : HIDDEN_WITH_ROW
          )}
        >
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
      <AppMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <AppMenuTrigger asChild>
          {/* Shift+F10 reaches it from the row, so Tab goes row to row. */}
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            tabIndex={-1}
            aria-label="More"
            className={cn(
              'absolute top-1 right-1 bg-pane-raised',
              isMenuOpen ? 'visible' : SHOWN_WITH_ROW
            )}
          >
            <Ellipsis className="size-3.5" />
          </AppButton>
        </AppMenuTrigger>
        <AppMenuContent
          align="end"
          className="min-w-49"
          onCloseAutoFocus={(event) => {
            // Back on the row, whose arrow keys carry on. Delete's question takes it instead.
            event.preventDefault();
            rowRef.current?.focus({ preventScroll: true });
          }}
        >
          <AppMenuItem onSelect={onOpen}>
            <ChevronRight />
            Open
          </AppMenuItem>
          {isRunning && (
            <AppMenuItem onSelect={onStop}>
              <Square />
              Stop the run
            </AppMenuItem>
          )}
          <AppMenuSeparator />
          <AppMenuItem variant="destructive" onSelect={onAskDelete}>
            <Trash2 />
            Delete…
          </AppMenuItem>
        </AppMenuContent>
      </AppMenu>
      {failure && (
        <span
          role="alert"
          className="flex flex-wrap items-baseline gap-x-2 px-2 pt-0.5 pb-2 pl-6.5"
        >
          <Text variant="secondary" className="text-ink-soft">
            {failure.words}
          </Text>
          <AppButton
            variant="link"
            onClick={failure.onTryAgain}
            className="h-auto p-0 align-baseline text-support underline underline-offset-2"
          >
            Try again
          </AppButton>
        </span>
      )}
    </div>
  );
}
