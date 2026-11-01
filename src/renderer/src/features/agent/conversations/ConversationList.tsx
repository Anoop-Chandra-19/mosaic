import { useEffect, useRef, type KeyboardEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { AppButton, Note, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { ConversationRow, ROW_ATTRIBUTE, ROW_GRID } from './ConversationRow';
import { groupConversations } from './conversationListWords';
import { CONVERSATION_PAGE_SIZE, useConversationPages } from './useConversationPages';

/** How near the end the next page is asked for: about two rows. */
const NEAR_END_PX = 80;

const OPEN_FAILED = 'Couldn’t open it. Nothing was changed.';

/** Comes in only if the read is slow enough to see, so a quick one never flashes it. */
const PLACEHOLDER =
  'grid animate-in grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 py-2.25 pr-2 pl-1 delay-150 duration-150 fill-mode-both fade-in-0';
const PLACEHOLDER_LINE =
  'col-start-2 block h-2 animate-pulse rounded-[0.1875rem] bg-line motion-reduce:animate-none';

function Placeholders({ count }: { count: number }) {
  return (
    <div aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={PLACEHOLDER}>
          <span className={PLACEHOLDER_LINE} />
          <span className={cn(PLACEHOLDER_LINE, 'w-[46%]')} />
        </div>
      ))}
    </div>
  );
}

function NothingYet({ onOpenNew }: { onOpenNew: () => void }) {
  return (
    <div className="m-auto flex max-w-70 flex-col items-center px-5 pt-6 pb-15 text-center">
      <Text as="h3" variant="strong">
        No conversations yet
      </Text>
      <Text as="p" variant="secondary" className="mt-1 mb-3 text-pretty text-ink-muted">
        Each one is kept on your computer from its first message until you delete it.
      </Text>
      <AppButton variant="outline" size="sm" onClick={onOpenNew}>
        Ask something
      </AppButton>
    </div>
  );
}

function CouldNotRead({ failure, onTryAgain }: { failure: string | null; onTryAgain: () => void }) {
  return (
    <div className="m-3">
      <Note icon={TriangleAlert} tone="warn" role="alert">
        <Text as="p" variant="strong">
          Couldn’t read your conversations
        </Text>
        <Text as="p" variant="secondary" className="mt-0.75 text-pretty text-ink-soft">
          Mosaic couldn’t read them from your computer. Nothing was changed, and the conversation
          you have open still works.
        </Text>
        {failure && (
          <Text as="p" variant="meta" className="mt-1.75 wrap-anywhere text-ink-muted">
            {failure}
          </Text>
        )}
        <AppButton variant="outline" size="xs" className="mt-2.5" onClick={onTryAgain}>
          Try again
        </AppButton>
      </Note>
    </div>
  );
}

function NewConversationRow({ onOpenNew }: { onOpenNew: () => void }) {
  return (
    <div role="listitem">
      <AppButton
        variant="plain"
        {...{ [ROW_ATTRIBUTE]: true }}
        aria-current="true"
        onClick={onOpenNew}
        className={cn(ROW_GRID, 'border border-dashed border-line-heavy hover:bg-line')}
      >
        <span />
        <Text variant="strong">New conversation</Text>
        <span />
        <Text variant="secondary" className="col-span-2 col-start-2 text-ink-muted">
          Open now. Not kept until you send something.
        </Text>
      </AppButton>
    </div>
  );
}

function rowsIn(list: HTMLElement | null): HTMLElement[] {
  return list ? [...list.querySelectorAll<HTMLElement>(`[${ROW_ATTRIBUTE}]`)] : [];
}

/** The arrow keys' next row; null for a key that isn't theirs. */
function findRowForKey(key: string, rows: HTMLElement[], at: number): HTMLElement | null {
  const places: Record<string, number> = {
    ArrowDown: at < 0 ? 0 : at + 1,
    ArrowUp: at < 0 ? 0 : at - 1,
    Home: 0,
    End: rows.length - 1,
  };
  const place = places[key];
  if (place === undefined) return null;
  return rows[Math.max(0, Math.min(rows.length - 1, place))] ?? null;
}

interface ConversationListProps {
  /** Null for a new conversation, not stored until its first send. */
  currentId: number | null;
  /** The conversation with a run going, and that run. */
  running: { runId: number; conversationId: number } | null;
  failedOpenId: number | null;
  onOpen: (conversationId: number) => void;
  onOpenNew: () => void;
  onBack: () => void;
}

/**
 * Every conversation, most recently active first, over everything in the pane below its
 * header. Keys: ↑ ↓ Home End move, Enter opens, Esc goes back.
 */
export function ConversationList({
  currentId,
  running,
  failedOpenId,
  onOpen,
  onOpenNew,
  onBack,
}: ConversationListProps) {
  const { pages, readNextPage, tryAgain } = useConversationPages(running?.runId ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const isReady = pages.readState === 'ready';

  // Focus waits here for the rows, then lands on the conversation you came from.
  useEffect(() => {
    listRef.current?.focus({ preventScroll: true });
  }, []);
  const hasLanded = useRef(false);
  useEffect(() => {
    if (!isReady || hasLanded.current) return;
    hasLanded.current = true;
    const rows = rowsIn(listRef.current);
    const row = rows.find((candidate) => candidate.hasAttribute('aria-current')) ?? rows[0];
    row?.focus();
  }, [isReady]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    const rows = rowsIn(listRef.current);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const row = findRowForKey(event.key, rows, at);
    if (!row) return;
    event.preventDefault();
    row.focus();
  };

  const isEmpty = isReady && pages.rows.length === 0;

  return (
    <div
      ref={listRef}
      role="region"
      aria-label="Conversations"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="@container/list flex h-full flex-col bg-pane outline-none"
    >
      {pages.readState === 'failed' && (
        <CouldNotRead failure={pages.failure} onTryAgain={tryAgain} />
      )}
      {isEmpty && <NothingYet onOpenNew={onOpenNew} />}
      {pages.readState === 'loading' && (
        <div className="px-2">
          <Placeholders count={4} />
        </div>
      )}
      {isReady && !isEmpty && (
        <div
          role="list"
          onScroll={(event) => {
            const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
            if (scrollHeight - scrollTop - clientHeight <= NEAR_END_PX) void readNextPage();
          }}
          className="min-h-0 flex-1 overflow-y-auto px-2 pt-0.5 pb-3 @min-[30rem]/list:px-3"
        >
          {currentId === null && <NewConversationRow onOpenNew={onOpenNew} />}
          {groupConversations(pages.rows).map(({ label, rows }) => (
            <div key={label} role="presentation">
              <Text
                as="p"
                aria-hidden
                variant="eyebrow"
                className="px-2 pt-3 pb-1 pl-6.5 text-ink-faint"
              >
                {label}
              </Text>
              {rows.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isCurrent={conversation.id === currentId}
                  isRunning={conversation.id === running?.conversationId}
                  failure={conversation.id === failedOpenId ? OPEN_FAILED : null}
                  onOpen={() => onOpen(conversation.id)}
                />
              ))}
            </div>
          ))}
          {pages.hasMore && <Placeholders count={2} />}
          {!pages.hasMore && pages.rows.length > CONVERSATION_PAGE_SIZE && (
            <Text as="p" variant="secondary" className="px-2 pt-3 pb-0.5 pl-6.5 text-ink-faint">
              That’s every conversation.
            </Text>
          )}
        </div>
      )}
    </div>
  );
}
