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

  it('stops after five refusals in a row, and an answer resets the count', () => {
    const limits = createRunLimits();
    const refuse = (id: string) => limits.noteAnswer('propose_rewrite', { id }, refusal(id)).stop;

    ['b1', 'b2', 'b3', 'b4'].forEach((id) => expect(refuse(id)).toBeUndefined());
    limits.noteAnswer('read_document', {}, { content: 'Name: Ada Quill', isError: false });
    ['b5', 'b6', 'b7', 'b8'].forEach((id) => expect(refuse(id)).toBeUndefined());
    expect(refuse('b9')).toEqual({ reason: 'refusalsInARow', detail: 'b9' });
  });
});
