import { describe, expect, it } from 'vitest';
import { createRunLimits, REPEAT_WARNING } from '../runLimits';

const refusal = (content: string) => ({ content, isError: true });

describe('createRunLimits', () => {
  it('warns on the second same refusal and stops on the third; another reason starts over', () => {
    const limits = createRunLimits();
    const note = (content: string) =>
      limits.noteAnswer('propose_reorder', { order: ['e1'] }, refusal(content));

    expect(note('order mixes lists')).toEqual({ content: 'order mixes lists' });
    expect(note('another reason')).toEqual({ content: 'another reason' });
    expect(note('another reason')).toEqual({ content: `another reason\n${REPEAT_WARNING}` });
    expect(note('another reason').stop).toEqual({
      reason: 'repeatedCall',
      detail: 'another reason',
    });
  });

  it('stops after three steps refused in a row, however many calls each made', () => {
    const limits = createRunLimits();
    const answered = { content: 'Name: Ada Quill', isError: false };
    const refusedStep = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map(refusal);

    expect(limits.noteStep(refusedStep)).toBeUndefined();
    expect(limits.noteStep(refusedStep)).toBeUndefined();
    expect(limits.noteStep([refusal('b1'), answered])).toBeUndefined();
    expect(limits.noteStep([])).toBeUndefined();
    expect(limits.noteStep(refusedStep)).toBeUndefined();
    expect(limits.noteStep(refusedStep)).toBeUndefined();
    expect(limits.noteStep(refusedStep)).toEqual({ reason: 'refusalsInARow', detail: 'b6' });
  });
});
