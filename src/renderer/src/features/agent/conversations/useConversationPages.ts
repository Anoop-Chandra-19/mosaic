import { useCallback, useEffect, useRef, useState } from 'react';
import { agentService } from '@/lib/services/agentService';
import type { ConversationSummary } from '@shared/types/agentBridge';

export const CONVERSATION_PAGE_SIZE = 50;

export interface ConversationPages {
  rows: ConversationSummary[];
  hasMore: boolean;
  /** `failed` only when there is nothing held to show. */
  readState: 'loading' | 'ready' | 'failed';
  /** The database's own words, for a list that couldn't be read. */
  failure: string | null;
  /**
   * Rises when rows go or change places, for them to move. Not when a page lands below: those
   * rows just arrive out of view.
   */
  moves: number;
}

const NOTHING_READ: ConversationPages = {
  rows: [],
  hasMore: false,
  readState: 'loading',
  failure: null,
  moves: 0,
};

const isSameOrder = (a: ConversationSummary[], b: ConversationSummary[]) =>
  a.length === b.length && a.every((row, index) => row.id === b[index].id);

/**
 * The newest page over what is held. A run moves its conversation to the top, so the page
 * takes over from the held rows wherever they overlap, and pages already read past it stay.
 */
export function mergeFirstPage(
  held: ConversationPages,
  page: ConversationSummary[]
): ConversationPages {
  const ids = new Set(page.map((row) => row.id));
  const lastOfPage = page.at(-1);
  const older = lastOfPage
    ? held.rows.filter(
        (row) =>
          !ids.has(row.id) &&
          (row.lastActiveAt < lastOfPage.lastActiveAt ||
            (row.lastActiveAt === lastOfPage.lastActiveAt && row.id < lastOfPage.id))
      )
    : [];
  const rows = [...page, ...older];
  return {
    rows,
    hasMore: older.length > 0 ? held.hasMore : page.length === CONVERSATION_PAGE_SIZE,
    readState: 'ready',
    failure: null,
    // The first read has nothing to move from.
    moves: held.readState !== 'ready' || isSameOrder(held.rows, rows) ? held.moves : held.moves + 1,
  };
}

/** What main's bridge adds in front of an error's own message. */
const readFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  );

/**
 * The list's rows while it is open, read a page at a time as it scrolls. The newest page is
 * read again whenever `readAgainOn` changes, which is a run starting or ending.
 */
export function useConversationPages(readAgainOn: number | null) {
  const [pages, setPages] = useState(NOTHING_READ);
  const isReadingMore = useRef(false);
  // A read that was under way when a row was deleted may still have it.
  const deletedIds = useRef(new Set<number>());

  const readFirstPage = useCallback(async () => {
    try {
      const page = await agentService.readConversations({ limit: CONVERSATION_PAGE_SIZE });
      const kept = page.filter((row) => !deletedIds.current.has(row.id));
      setPages((held) => mergeFirstPage(held, kept));
    } catch (error) {
      console.error('Couldn’t read the conversations', error);
      setPages((held) =>
        held.rows.length > 0
          ? held
          : { ...NOTHING_READ, readState: 'failed', failure: readFailure(error) }
      );
    }
  }, []);

  useEffect(() => {
    void readFirstPage();
  }, [readFirstPage, readAgainOn]);

  const readNextPage = async () => {
    const last = pages.rows.at(-1);
    if (!last || !pages.hasMore || isReadingMore.current) return;
    isReadingMore.current = true;
    try {
      const page = await agentService.readConversations({
        after: { lastActiveAt: last.lastActiveAt, id: last.id },
        limit: CONVERSATION_PAGE_SIZE,
      });
      setPages((held) => {
        const ids = new Set([...held.rows.map((row) => row.id), ...deletedIds.current]);
        return {
          ...held,
          rows: [...held.rows, ...page.filter((row) => !ids.has(row.id))],
          hasMore: page.length === CONVERSATION_PAGE_SIZE,
        };
      });
    } catch (error) {
      // Scrolling again asks again.
      console.error('Couldn’t read more conversations', error);
    } finally {
      isReadingMore.current = false;
    }
  };

  const tryAgain = () => {
    setPages(NOTHING_READ);
    void readFirstPage();
  };

  const removeRow = (conversationId: number) => {
    deletedIds.current.add(conversationId);
    setPages((held) => ({
      ...held,
      rows: held.rows.filter((row) => row.id !== conversationId),
      moves: held.moves + 1,
    }));
  };

  return { pages, readNextPage, tryAgain, removeRow };
}
