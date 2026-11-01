import { describe, expect, it } from 'vitest';
import type { Proposal, ProposalStatus } from '@/types/agentProposal';
import {
  findAppliedVersionId,
  findFirstToReview,
  findRunSuggestions,
  listSections,
  readRunCard,
} from '../runCard';

const suggestion = (id: string, status: ProposalStatus = 'pending', isStale = false) =>
  ({ id, status, isStale, templateId: 't1' }) as Proposal;

const FINISHED = { isCancelled: false, isStopDecided: false };
const STOPPED = { isCancelled: true, isStopDecided: false };
const DECIDED = { isCancelled: true, isStopDecided: true };

describe('readRunCard', () => {
  it('offers what a finished run staged', () => {
    const card = readRunCard({ staged: [suggestion('a'), suggestion('b')], ...FINISHED });
    expect(card.handle?.title).toBe('2 suggestions ready to review');
    expect(card.stopQuestion).toBeNull();
    expect(card.applied).toBeNull();
  });

  it('says one suggestion, and how many of them are out of date', () => {
    const staged = [suggestion('a'), suggestion('b', 'pending', true)];
    expect(readRunCard({ staged, ...FINISHED }).handle?.title).toBe(
      '1 suggestion ready to review · 1 out of date'
    );
    const allStale = readRunCard({ staged: [suggestion('b', 'pending', true)], ...FINISHED });
    expect(allStale.handle).toMatchObject({ title: '1 suggestion out of date', isAllStale: true });
  });

  it('asks once about what a Stop left, then offers it like any other', () => {
    const staged = [suggestion('a'), suggestion('b')];
    const asked = readRunCard({ staged, ...STOPPED });
    expect(asked.stopQuestion).toMatchObject({ count: 2, keepLabel: 'Keep 2 staged' });
    expect(asked.handle).toBeNull();

    const kept = readRunCard({ staged, ...DECIDED });
    expect(kept.stopQuestion).toBeNull();
    expect(kept.handle).not.toBeNull();
  });

  it('asks nothing when a Stop left nothing, and notes when the turn was discarded', () => {
    expect(readRunCard({ staged: [], ...STOPPED })).toMatchObject({
      stopQuestion: null,
      isDiscarded: false,
    });
    expect(readRunCard({ staged: [], ...DECIDED }).isDiscarded).toBe(true);
    expect(readRunCard({ staged: [], ...FINISHED }).isDiscarded).toBe(false);
  });

  it('counts what was applied out of all of them, beside what still waits', () => {
    const staged = [suggestion('a', 'applied'), suggestion('b', 'rejected'), suggestion('c')];
    const card = readRunCard({ staged, ...FINISHED });
    expect(card.applied).toBe('Applied 1 of 3 suggestions');
    expect(card.handle?.title).toBe('1 suggestion ready to review');
  });

  it('has nothing to offer once every suggestion is dealt with', () => {
    const staged = [suggestion('a', 'applied'), suggestion('b', 'rejected')];
    const card = readRunCard({ staged, ...FINISHED });
    expect(card.handle).toBeNull();
    expect(card.applied).toBe('Applied 1 of 2 suggestions');
  });
});

describe('finding a run’s suggestions', () => {
  it('looks in every resume, and misses the ones that have gone', () => {
    const byTemplate = { t1: [suggestion('a')], t2: [suggestion('b'), suggestion('c')] };
    const found = findRunSuggestions(byTemplate, ['a', 'c', 'gone']);
    expect(found.map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('opens on the first that can still be applied', () => {
    const staged = [
      suggestion('applied', 'applied'),
      suggestion('stale', 'pending', true),
      suggestion('current'),
    ];
    expect(findFirstToReview(staged)?.id).toBe('current');
    expect(findFirstToReview(staged.slice(0, 2))?.id).toBe('stale');
    expect(findFirstToReview(staged.slice(0, 1))).toBeUndefined();
  });

  it('names each section once, for the open resume only', () => {
    const elsewhere = { ...suggestion('c'), templateId: 't2' };
    const staged = [suggestion('a'), suggestion('b'), elsewhere, suggestion('d', 'rejected')];
    const place = ({ id }: Proposal) => (id === 'b' ? ['Skills'] : ['Experience', 'Fastly']);
    expect(listSections(staged, 't1', place)).toEqual(['Experience', 'Skills']);
  });

  it('finds the newest version that holds any of them', () => {
    const versions = { v1: ['a'], v2: ['x'], v3: ['a', 'b'] };
    expect(findAppliedVersionId(versions, [suggestion('a')])).toBe('v3');
    expect(findAppliedVersionId(versions, [suggestion('z')])).toBeNull();
  });
});
