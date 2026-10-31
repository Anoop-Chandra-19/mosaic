import { describe, expect, it } from 'vitest';
import { splitFinishedBlocks } from '../splitFinishedBlocks';

describe('splitFinishedBlocks', () => {
  it('ends a block at a blank line, and the blocks join back into the text', () => {
    const text = 'First point.\n\n- Go\n- SQL\n\nLast po';
    const blocks = splitFinishedBlocks(text);
    expect(blocks).toEqual(['First point.\n\n', '- Go\n- SQL\n\n', 'Last po']);
    expect(blocks.join('')).toBe(text);
  });

  it.each([
    ['a code fence', '```\nfirst\n\nsecond'],
    ['a closed fence of another kind', '~~~\n```\n\nstill code'],
    ['a list with blank lines between items', '- Go\n\n- SQL\n\n1. Rust'],
    ['an item’s indented paragraph', '- Go\n\n  more about Go'],
    ['a line of markers before its words', 'Strongest points:\n\n**'],
  ])('keeps whole: %s', (_name, text) => {
    expect(splitFinishedBlocks(text)).toEqual([text]);
  });

  it('carries on after a fence closes', () => {
    expect(splitFinishedBlocks('```\ncode\n\nmore\n```\n\nAfter')).toEqual([
      '```\ncode\n\nmore\n```\n\n',
      'After',
    ]);
  });
});
