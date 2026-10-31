import { describe, expect, it } from 'vitest';
import { advancePace, cutAtWordEnd, noteArrival, type TextPace } from '../paceText';

const CAUGHT_UP: TextPace = { shownTo: 0, charsPerMs: 0 };

describe('paceText', () => {
  it('clears a burst within the limit, however fast later text comes', () => {
    let pace = noteArrival(CAUGHT_UP, 500, 500);
    expect(pace.charsPerMs).toBe(1);
    pace = advancePace(pace, 500, 250);
    pace = noteArrival(pace, 2250, 500);
    expect(pace.charsPerMs).toBe(4);
    pace = advancePace(pace, 2250, 500);
    expect(pace).toEqual({ shownTo: 2250, charsPerMs: 0 });
  });

  it('never slows down while text is waiting', () => {
    const pace = noteArrival({ shownTo: 0, charsPerMs: 3 }, 10, 500);
    expect(pace.charsPerMs).toBe(3);
  });

  it('with no time allowed behind, shows everything on the next tick', () => {
    const pace = noteArrival(CAUGHT_UP, 5000, 0);
    expect(advancePace(pace, 5000, 16)).toEqual({ shownTo: 5000, charsPerMs: 0 });
  });

  it('stops when the text gets shorter than what was shown', () => {
    expect(noteArrival({ shownTo: 100, charsPerMs: 2 }, 40, 500)).toEqual({
      shownTo: 40,
      charsPerMs: 0,
    });
  });

  it('cuts at the end of the last whole word, until it has caught up', () => {
    const text = 'Led the billing\nmigration';
    expect(cutAtWordEnd(text, 6)).toBe('Led');
    expect(cutAtWordEnd(text, 7)).toBe('Led the');
    expect(cutAtWordEnd(text, 20)).toBe('Led the billing');
    expect(cutAtWordEnd(text, text.length)).toBe(text);
  });
});
