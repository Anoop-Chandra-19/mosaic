import { describe, expect, it } from 'vitest';
import { filterStepOptions } from '../filterStepOptions';

const VERSIONS = ['v120', 'v99', 'v91', 'v12.1', 'v12', 'v9'].map((label) => ({
  value: label,
  label,
  detail: label === 'v12' ? 'Sent to Kestrel' : 'Editing session',
}));

const labels = (query: string) => filterStepOptions(VERSIONS, query).map(({ label }) => label);

describe('filterStepOptions', () => {
  it('finds versions by number, the shortest first', () => {
    expect(labels('9')).toEqual(['v9', 'v99', 'v91']);
    expect(labels('v12')).toEqual(['v12', 'v120', 'v12.1']);
    expect(labels('12.')).toEqual(['v12.1']);
  });

  it('finds choices by the words in them', () => {
    expect(labels('kestrel')).toEqual(['v12']);
    expect(labels('editing v12.')).toEqual(['v12.1']);
    expect(labels('')).toHaveLength(VERSIONS.length);
  });

  it('reads a number as words where the choices aren’t versions', () => {
    const steps = [
      { value: 1, label: 'Welcome', hint: 'step 1' },
      { value: 2, label: 'History', hint: 'step 2' },
    ];
    expect(filterStepOptions(steps, '2').map(({ label }) => label)).toEqual(['History']);
  });
});
