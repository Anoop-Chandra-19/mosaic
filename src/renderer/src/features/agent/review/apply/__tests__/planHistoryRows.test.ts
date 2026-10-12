import { describe, expect, it } from 'vitest';
import type { VersionMeta } from '@shared/types/db';
import { readAddToOffer, type HistoryChoice } from '../historyChoice';
import { planHistoryRows } from '../planHistoryRows';

const NOW = 1_000_000_000;
const HOUR = 60 * 60_000;

function makeHead(overrides: Partial<VersionMeta>): VersionMeta {
  return {
    id: 'head',
    templateId: 'template',
    number: 12,
    revision: 0,
    parentId: null,
    kind: 'auto',
    source: 'assistant',
    summary: '2 suggestions in Harbor Freight Labs',
    section: null,
    rev: 40,
    createdAt: NOW - HOUR,
    ...overrides,
  };
}

const choose = (mode: HistoryChoice['mode'], name = ''): HistoryChoice => ({ mode, name });

const plan = (head: VersionMeta | undefined, draftRev: number, choice: HistoryChoice) =>
  planHistoryRows({
    head,
    draftRev,
    choice,
    landedTitle: '3 suggestions in Lantern Geo',
    keepsVersions: true,
    now: NOW,
  });

const brief = (rows: ReturnType<typeof plan>) =>
  rows.map(({ label, look, isNew }) => `${label} ${look}${isNew ? '' : ' (there)'}`);

describe('planHistoryRows', () => {
  it('keeps the draft before and after when it changed since the last version', () => {
    const head = makeHead({ source: 'name', kind: 'named', rev: 30 });
    expect(brief(plan(head, 40, choose('new')))).toEqual(['v14 assistant', 'v13 before']);
  });

  it('writes no before row when the newest version already holds the draft', () => {
    const head = makeHead({ source: 'name', kind: 'named' });
    expect(brief(plan(head, 40, choose('new')))).toEqual(['v13 assistant']);
  });

  it('makes the before row a revision of an editing session still open', () => {
    const head = makeHead({
      source: 'edit',
      number: 11,
      revision: 2,
      rev: 30,
      createdAt: NOW - 60_000,
    });
    const rows = plan(head, 40, choose('new'));
    expect(brief(rows)).toEqual(['v12 assistant', 'v11.3 before']);
    expect(rows[1].sub).toBe('Last revision of v11');
  });

  it('adds to the assistant version as a revision, with that version faded after it', () => {
    const rows = plan(makeHead({ revision: 1 }), 40, choose('add'));
    expect(brief(rows)).toEqual(['v12.2 assistant', 'v12.1 assistant (there)']);
    expect(rows[0].sub).toBe('Revision of v12');
  });

  it('names the version after with the name given, saying what it holds under it', () => {
    const [named] = plan(makeHead({}), 40, choose('named', 'For Northwind'));
    expect(named).toMatchObject({ title: 'For Northwind', look: 'named' });
    expect(named.sub).toBe('3 suggestions in Lantern Geo');
  });

  it('adds nothing when versions after the assistant are off', () => {
    const rows = planHistoryRows({
      head: makeHead({}),
      draftRev: 41,
      choice: choose('new'),
      landedTitle: 'x',
      keepsVersions: false,
      now: NOW,
    });
    expect(rows).toEqual([]);
  });
});

describe('readAddToOffer', () => {
  it('is offered only after the assistant’s own version', () => {
    expect(readAddToOffer(makeHead({ source: 'edit' }), 40)).toBeNull();
    expect(readAddToOffer(undefined, 40)).toBeNull();
  });

  it('can be used while the draft still matches that version', () => {
    expect(readAddToOffer(makeHead({}), 40)).toEqual({
      label: 'v12',
      revisionLabel: 'v12.1',
      refusal: null,
    });
  });

  it('says why not once the draft moved, or the version was named', () => {
    expect(readAddToOffer(makeHead({}), 41)?.refusal).toBe(
      'Your draft changed since v12, so it can’t be added to.'
    );
    expect(readAddToOffer(makeHead({ kind: 'named' }), 40)?.refusal).toBe(
      'v12 is named, so it can’t be added to.'
    );
  });
});
