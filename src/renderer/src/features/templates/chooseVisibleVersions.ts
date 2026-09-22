import type { VersionMeta } from '@shared/types/db';

/** Above this many versions the sidebar stops holding the whole history and hands off. */
export const BROWSE_CAP = 400;
/** A filtered list shows this many matches; the rest are for the full history view. */
export const FOUND_CAP = 150;
const RECENT_DAYS = 30;
const RECENT_MIN_ROWS = 40;
const RECENT_MAX_ROWS = 140;
const DAY_MS = 86_400_000;

export interface VisibleVersions {
  /** Newest first: always the newest of the matches, never a window in the middle. */
  shown: VersionMeta[];
  /** Matches older than the last one shown. */
  hiddenCount: number;
  /** `recent`: a long history cut to its last month. `found`: a filter's matches. */
  mode: 'whole' | 'recent' | 'found';
}

/**
 * What the sidebar renders of a history. Under `BROWSE_CAP` it is all of it; over, the
 * last 30 days, never fewer than 40 rows or more than 140. A filter caps by count alone,
 * and still reaches the whole history, because finding a version should not need the
 * full view first.
 */
export function chooseVisibleVersions(
  matched: VersionMeta[],
  {
    total,
    isFiltering = false,
    now = Date.now(),
  }: { total: number; isFiltering?: boolean; now?: number }
): VisibleVersions {
  if (isFiltering || total <= BROWSE_CAP) {
    const cap = isFiltering ? FOUND_CAP : BROWSE_CAP;
    return {
      shown: matched.slice(0, cap),
      hiddenCount: Math.max(0, matched.length - cap),
      mode: isFiltering ? 'found' : 'whole',
    };
  }
  const cutoff = now - RECENT_DAYS * DAY_MS;
  const inWindow = matched.filter((version) => version.createdAt >= cutoff).length;
  const count = Math.min(
    matched.length,
    Math.max(RECENT_MIN_ROWS, Math.min(RECENT_MAX_ROWS, inWindow))
  );
  return { shown: matched.slice(0, count), hiddenCount: matched.length - count, mode: 'recent' };
}
