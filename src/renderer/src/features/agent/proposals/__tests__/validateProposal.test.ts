import { describe, expect, it } from 'vitest';
import type { ProposalChange } from '@shared/types/agentProposal';
import { validateProposal } from '../validateProposal';
import { makeResume, rewrite } from './proposalFixtures';

const B1 = 'Assisted in migrating billing to Postgres';
const codeOf = (change: ProposalChange) => validateProposal(makeResume(), change)?.code ?? null;

describe('validateProposal', () => {
  it('takes a change made against the text as it reads', () => {
    expect(codeOf(rewrite('b1', B1, 'Led the billing migration to Postgres'))).toBeNull();
  });

  it('refuses a target that is not there, and text that changed since it was read', () => {
    expect(codeOf(rewrite('b9', B1, 'Led it'))).toBe('unknown-target');
    expect(codeOf(rewrite('b1', 'Assisted in migrating billing', 'Led it'))).toBe(
      'changed-since-read'
    );
  });

  it('says what to do about a refusal', () => {
    expect(validateProposal(makeResume(), rewrite('b1', B1, B1))).toEqual({
      code: 'unchanged',
      fix: 'This changes nothing. Leave it out.',
    });
  });

  it('refuses empty text: leaving a bullet off is hiding it, never deleting', () => {
    expect(codeOf(rewrite('b1', B1, '   '))).toBe('empty-text');
  });

  it('refuses any change that is not a bullet change: the fact fence', () => {
    const titleEdit = { kind: 'field', sectionId: 's1', entryId: 'e1', field: 'title' };
    expect(codeOf(titleEdit as unknown as ProposalChange)).toBe('unknown-change');
  });

  it('checks a split falls inside the text', () => {
    const split = (at: number): ProposalChange => ({
      kind: 'split',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b1',
      before: B1,
      at,
    });
    expect(codeOf(split(12))).toBeNull();
    expect(codeOf(split(0))).toBe('bad-split');
    expect(codeOf(split(B1.length))).toBe('bad-split');
    expect(codeOf(split(1.5))).toBe('bad-split');
  });

  it('only merges two bullets that sit together and read as they did', () => {
    const doc = makeResume();
    const [b1, b2, b3] = doc.sections[0].items[0].bullets;
    const merge = (
      firstId: string,
      secondId: string,
      before: [string, string]
    ): ProposalChange => ({
      kind: 'merge',
      sectionId: 's1',
      entryId: 'e1',
      firstId,
      secondId,
      before,
      after: 'Merged',
    });
    expect(codeOf(merge('b1', 'b2', [b1.text, b2.text]))).toBeNull();
    expect(codeOf(merge('b1', 'b3', [b1.text, b3.text]))).toBe('changed-since-read');
    expect(codeOf(merge('b1', 'b2', [b1.text, 'old text']))).toBe('changed-since-read');
  });

  it('takes a new order only of the same ids, and only when it is new', () => {
    const reorder = (before: string[], after: string[]): ProposalChange => ({
      kind: 'reorder',
      sectionId: 's1',
      entryId: 'e1',
      before,
      after,
    });
    expect(codeOf(reorder(['b1', 'b2', 'b3'], ['b3', 'b1', 'b2']))).toBeNull();
    expect(codeOf(reorder(['b1', 'b2', 'b3'], ['b3', 'b3', 'b2']))).toBe('not-a-permutation');
    expect(codeOf(reorder(['b1', 'b2', 'b3'], ['b1', 'b2', 'b3']))).toBe('unchanged');
    expect(codeOf(reorder(['b2', 'b1', 'b3'], ['b3', 'b1', 'b2']))).toBe('changed-since-read');
  });

  it('refuses hiding a bullet that is already hidden', () => {
    const select = (selected: boolean): ProposalChange => ({
      kind: 'select',
      sectionId: 's1',
      entryId: 'e1',
      bulletId: 'b1',
      before: B1,
      selected,
    });
    expect(codeOf(select(false))).toBeNull();
    expect(codeOf(select(true))).toBe('unchanged');
  });
});
