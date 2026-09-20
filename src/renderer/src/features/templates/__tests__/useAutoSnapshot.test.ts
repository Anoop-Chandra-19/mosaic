import { describe, expect, it } from 'vitest';
import {
  AUTO_SNAPSHOT_CHANGES,
  AUTO_SNAPSHOT_INTERVAL_MS,
  isAutoSnapshotDue,
  msUntilAutoSnapshot,
} from '../useAutoSnapshot';

describe('auto snapshot timing', () => {
  it('waits for enough changes to be worth keeping', () => {
    expect(isAutoSnapshotDue(0)).toBe(false);
    expect(isAutoSnapshotDue(AUTO_SNAPSHOT_CHANGES - 1)).toBe(false);
    expect(isAutoSnapshotDue(AUTO_SNAPSHOT_CHANGES)).toBe(true);
  });

  it('counts the wait from the newest version, so editing on cannot put it off', () => {
    const version = 10_000;
    const typing = version + AUTO_SNAPSHOT_INTERVAL_MS - 1000;

    expect(msUntilAutoSnapshot(version, typing)).toBe(1000);
    expect(msUntilAutoSnapshot(version, typing + 2000)).toBe(0);
  });

  it('is due at once when the newest version is already old', () => {
    expect(msUntilAutoSnapshot(0, Date.now())).toBe(0);
  });
});
