import { describe, expect, it } from 'vitest';
import { hasSameWords } from '../hasSameWords';

describe('hasSameWords', () => {
  it.each([
    ['equal text', 'Led the team', 'Led the team'],
    ['one kept word between two changed spaces', 'Led  the  team', 'Led the team'],
    ['spaces at the ends', ' Led the team ', 'Led the team'],
    ['a line break for a space', 'Led the\nteam', 'Led the team'],
    ['nothing on both sides', '', '  '],
  ])('is true for %s', (_case, before, after) => {
    expect(hasSameWords(before, after)).toBe(true);
  });

  it.each([
    ['a changed word', 'Led the team', 'Led a team'],
    ['a word added', 'Led the team', 'Led the whole team'],
    ['words moved', 'Led the team', 'the Led team'],
    ['a different case', 'Led the team', 'led the team'],
    ['a space taken out of a word', 'Led the team', 'Ledthe team'],
  ])('is false for %s', (_case, before, after) => {
    expect(hasSameWords(before, after)).toBe(false);
  });
});
