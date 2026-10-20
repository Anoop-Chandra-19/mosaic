import { describe, expect, it } from 'vitest';
import { addRecentRun, describeRunArgs } from '../recentDevRuns';

describe('addRecentRun', () => {
  it('puts the run first, once, and keeps four', () => {
    const runs = ['a', 'b', 'c', 'd'].map((toolId) => ({ toolId, args: {} }));
    expect(addRecentRun(runs, { toolId: 'c', args: {} }).map((run) => run.toolId)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
    expect(addRecentRun(runs, { toolId: 'e', args: {} }).map((run) => run.toolId)).toEqual([
      'e',
      'a',
      'b',
      'c',
    ]);
  });

  it('keeps a tool once for each set of choices', () => {
    const twelve = { toolId: 'history', args: { version: 12 } };
    const nine = { toolId: 'history', args: { version: 9 } };
    expect(addRecentRun([twelve], nine)).toEqual([nine, twelve]);
    expect(addRecentRun([nine, twelve], { toolId: 'history', args: { version: 12 } })).toEqual([
      twelve,
      nine,
    ]);
  });
});

describe('describeRunArgs', () => {
  it('writes the choices in order', () => {
    expect(describeRunArgs({ toolId: 'profile', args: { profile: 'Heavy', version: 12 } })).toBe(
      'Heavy · 12'
    );
    expect(describeRunArgs({ toolId: 'stage', args: {} })).toBe('');
  });
});
