import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '@shared/types/agentBridge';
import {
  formatLastActive,
  formatResumeNames,
  groupConversations,
  titleConversation,
} from '../conversationListWords';
import {
  CONVERSATION_PAGE_SIZE,
  mergeFirstPage,
  type ConversationPages,
} from '../useConversationPages';

const row = (id: number, lastActiveAt: number): ConversationSummary => ({
  id,
  title: `Ask ${id}`,
  lastActiveAt,
  resumes: [],
  stop: null,
});

const at = (...parts: [number, number, number, number?]) =>
  new Date(parts[0], parts[1], parts[2], parts[3] ?? 12).getTime();

const NOW = at(2026, 10, 1, 15);

describe('groupConversations', () => {
  it('runs from today back through the months to earlier years', () => {
    const rows = [
      row(1, at(2026, 10, 1, 9)),
      row(2, at(2026, 9, 31, 22)),
      row(3, at(2026, 9, 29)),
      row(4, at(2026, 9, 14)),
      row(5, at(2026, 8, 18)),
      row(6, at(2025, 2, 3)),
    ];
    expect(
      groupConversations(rows, NOW).map(({ label, rows: held }) => [label, held.length])
    ).toEqual([
      ['Today', 1],
      ['Yesterday', 1],
      ['October', 2],
      ['September', 1],
      ['2025', 1],
    ]);
  });
});

describe('formatLastActive', () => {
  it('gives a clock time under Today and Yesterday, and a date before', () => {
    expect(formatLastActive(at(2026, 9, 31, 22), NOW)).toMatch(/\d:\d\d/);
    expect(formatLastActive(at(2026, 9, 30, 22), NOW)).toMatch(/Oct 30/);
  });
});

describe('formatResumeNames', () => {
  it.each([
    [['Base resume'], 'Base resume'],
    [['Base resume', 'Lantern Geo'], 'Base resume and Lantern Geo'],
    [['Base resume', 'Lantern Geo', 'Striped backend'], 'Base resume, Lantern Geo and 1 more'],
  ])('%j', (names, words) => {
    expect(formatResumeNames(names)).toBe(words);
  });
});

describe('titleConversation', () => {
  it('leaves a short name, and cuts a long one at a word', () => {
    expect(titleConversation('Make Skills shorter', 44)).toBe('Make Skills shorter');
    expect(titleConversation('Does the Harbor Freight entry read as senior?', 20)).toBe(
      'Does the Harbor…'
    );
  });
});

describe('mergeFirstPage', () => {
  const held = (rows: ConversationSummary[], hasMore: boolean): ConversationPages => ({
    rows,
    hasMore,
    readState: 'ready',
    failure: null,
    moves: 0,
  });

  it('moves a conversation to the top without losing the pages read past the first', () => {
    const merged = mergeFirstPage(held([row(3, 300), row(2, 200), row(1, 100)], true), [
      row(1, 400),
      row(3, 300),
    ]);
    expect(merged.rows.map(({ id }) => id)).toEqual([1, 3, 2]);
    expect(merged.hasMore).toBe(true);
    expect(merged.moves).toBe(1);
  });

  it('moves nothing when the order holds, or on the first read', () => {
    const rows = [row(2, 200), row(1, 100)];
    expect(mergeFirstPage(held(rows, false), rows).moves).toBe(0);
    expect(mergeFirstPage({ ...held([], false), readState: 'loading' }, rows).moves).toBe(0);
  });

  it('says more are there from the page, when none past it are held', () => {
    const full = Array.from({ length: CONVERSATION_PAGE_SIZE }, (_, index) => row(index + 1, 500));
    expect(mergeFirstPage(held([], false), full.slice(0, 3)).hasMore).toBe(false);
    expect(mergeFirstPage(held([], false), full).hasMore).toBe(true);
  });
});
