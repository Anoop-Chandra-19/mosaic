import { describe, expect, it } from 'vitest';
import { writeListItem } from '../writeListItem';

describe('writeListItem', () => {
  it.each([
    ['Go, Python, Postgres', 'Go, Python, Postgres, Rust'],
    ['Go · Python · Postgres', 'Go · Python · Postgres · Rust'],
    ['Go | Python | Postgres', 'Go | Python | Postgres | Rust'],
    ['Go / Python / Postgres', 'Go / Python / Postgres / Rust'],
    ['Go; Python; Postgres', 'Go; Python; Postgres; Rust'],
  ])('puts the item last in "%s" with the separator the line uses', (line, written) => {
    expect(writeListItem(line, 'Rust', undefined)).toEqual({ line: written });
  });

  it('puts the item first with "start"', () => {
    expect(writeListItem('Go, Python', 'Rust', 'start')).toEqual({ line: 'Rust, Go, Python' });
  });

  it('puts the item after the item named, whatever its case', () => {
    expect(writeListItem('Go, Python, Postgres', 'Rust', 'go')).toEqual({
      line: 'Go, Rust, Python, Postgres',
    });
  });

  it('keeps a label before the first item', () => {
    const line = 'Languages: Go, Python';
    expect(writeListItem(line, 'Rust', 'start')).toEqual({ line: 'Languages: Rust, Go, Python' });
    expect(writeListItem(line, 'Rust', 'Go')).toEqual({ line: 'Languages: Go, Rust, Python' });
  });

  it('returns the line unchanged when it already lists the item', () => {
    expect(writeListItem('Go, Python', 'python', undefined)).toEqual({ line: 'Go, Python' });
    expect(writeListItem('Languages: Go, Python', 'Go', undefined)).toEqual({
      line: 'Languages: Go, Python',
    });
  });

  it('fails on a line with no separator', () => {
    expect(writeListItem('Backend engineer for six years.', 'Rust', undefined)).toEqual({
      failure: 'notAList',
    });
  });

  it('fails when the item to go after is not listed', () => {
    expect(writeListItem('Go, Python', 'Rust', 'Java')).toEqual({ failure: 'afterNotListed' });
  });
});
