import { describe, expect, it } from 'vitest';
import type { VersionMeta } from '@shared/types/db';
import { BROWSE_CAP, chooseVisibleVersions, FOUND_CAP } from '../chooseVisibleVersions';

const NOW = new Date(2026, 8, 22, 18).getTime();
const HOUR = 3_600_000;

/** `count` versions, newest first, `spacingHours` apart. */
function history(count: number, spacingHours: number): VersionMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `v${count - i}`,
    templateId: 't',
    parentId: null,
    kind: 'auto',
    source: 'edit',
    summary: 'Edited a bullet in Experience',
    section: 'Experience',
    rev: count - i,
    createdAt: NOW - i * spacingHours * HOUR,
  }));
}

describe('chooseVisibleVersions', () => {
  it('shows the whole history up to the browse cap', () => {
    const versions = history(BROWSE_CAP, 1);
    expect(chooseVisibleVersions(versions, { total: versions.length, now: NOW })).toMatchObject({
      hiddenCount: 0,
      mode: 'whole',
    });
  });

  it('cuts a longer history to its last 30 days', () => {
    // Every 6 hours: 120 rows in 30 days.
    const versions = history(BROWSE_CAP + 1, 6);
    const view = chooseVisibleVersions(versions, { total: versions.length, now: NOW });
    expect(view.mode).toBe('recent');
    expect(view.shown).toHaveLength(121);
    expect(view.hiddenCount).toBe(versions.length - 121);
  });

  it('keeps the recent window between 40 and 140 rows', () => {
    const sparse = history(500, 72);
    expect(chooseVisibleVersions(sparse, { total: 500, now: NOW }).shown).toHaveLength(40);
    const dense = history(500, 1);
    expect(chooseVisibleVersions(dense, { total: 500, now: NOW }).shown).toHaveLength(140);
  });

  it('shows only the newest dozen of a template that is not open', () => {
    const versions = history(30, 1);
    const view = chooseVisibleVersions(versions, { total: 30, isCompact: true, now: NOW });
    expect(view).toMatchObject({ hiddenCount: 18, mode: 'compact' });
    expect(view.shown[0].id).toBe('v30');
  });

  it('caps a filter’s matches by count, however long the history', () => {
    const matches = history(FOUND_CAP + 5, 72);
    expect(
      chooseVisibleVersions(matches, { total: 2000, isFiltering: true, now: NOW })
    ).toMatchObject({ hiddenCount: 5, mode: 'found' });
  });
});
