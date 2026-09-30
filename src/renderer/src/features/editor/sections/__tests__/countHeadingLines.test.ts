import { describe, expect, it } from 'vitest';
import { countHeadingLines } from '../countHeadingLines';

const measure = (text: string) => text.length * 5;

describe('countHeadingLines', () => {
  it('counts the lines beside the dates, which keep their width', () => {
    const entry = {
      title: 'Senior Software Engineer',
      organization: 'Fictional Institute for Distributed Systems',
      location: 'Example City',
      dates: '',
    };
    expect(countHeadingLines(entry, 'letter', measure)).toBe(1);
    expect(
      countHeadingLines({ ...entry, dates: 'January 2020 to September 2026' }, 'letter', measure)
    ).toBe(2);
  });

  it('is none for an entry with no heading, and unknown without a way to measure', () => {
    const entry = { title: '', organization: ' ', location: '', dates: '2020' };
    expect(countHeadingLines(entry, 'a4', measure)).toBe(0);
    expect(countHeadingLines({ ...entry, title: 'Analyst' }, 'a4', null)).toBeNull();
  });
});
