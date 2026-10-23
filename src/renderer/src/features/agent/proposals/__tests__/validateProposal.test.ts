import { describe, expect, it } from 'vitest';
import type { ProposalChange } from '@shared/types/agentProposal';
import { validateProposal } from '../validateProposal';
import { addText, makeResume, makeResumeWithLines, rewrite } from './proposalFixtures';

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
      place: { unit: 'bullets', sectionId: 's1', entryId: 'e1' },
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
      place: { unit: 'bullet', sectionId: 's1', entryId: 'e1', bulletId: 'b1' },
      before: B1,
      selected,
    });
    expect(codeOf(select(false))).toBeNull();
    expect(codeOf(select(true))).toBe('unchanged');
  });
});

describe('validateProposal, added text and lines', () => {
  it('refuses empty added text, and a place that is gone', () => {
    expect(validateProposal(makeResumeWithLines(), addText('line', 'l2', '  '))?.code).toBe(
      'empty-text'
    );
    expect(validateProposal(makeResumeWithLines(), addText('line', 'l9', 'Rust'))?.code).toBe(
      'changed-since-read'
    );
    expect(validateProposal(makeResumeWithLines(), addText('line', null, 'Rust'))).toBeNull();
  });

  it('anchors a line rewrite to the line as it was read', () => {
    const place = { unit: 'line' as const, sectionId: 's2', lineId: 'l1' };
    const doc = makeResumeWithLines();
    expect(
      validateProposal(doc, {
        kind: 'rewrite',
        place,
        before: 'Backend engineer for six years.',
        after: 'Backend engineer.',
      })
    ).toBeNull();
    expect(
      validateProposal(doc, {
        kind: 'rewrite',
        place,
        before: 'Something else',
        after: 'Backend engineer.',
      })?.code
    ).toBe('changed-since-read');
  });
});

describe('validateProposal, whole entries and sections', () => {
  it('anchors on a heading or label, and refuses leaving what is already off the page', () => {
    const doc = makeResumeWithLines();
    const leave = (before: string): ProposalChange => ({
      kind: 'select',
      place: { unit: 'section', sectionId: 's3' },
      before,
      selected: false,
    });
    expect(validateProposal(doc, leave('Skills'))).toBeNull();
    expect(validateProposal(doc, leave('Tools'))?.code).toBe('changed-since-read');
    doc.sections[2].hidden = true;
    expect(validateProposal(doc, leave('Skills'))?.code).toBe('unchanged');
  });
});
