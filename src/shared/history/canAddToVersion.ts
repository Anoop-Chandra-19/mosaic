import type { SnapshotOccasion, VersionMeta, VersionSource } from '../types/db';

/*
 * When a new snapshot adds a revision to the newest version (v7 → v7.1) instead of taking
 * a new number. A version is added to only while it is the newest, and by the same kind of
 * work that made it: automatic work only to automatic versions, the user's naming to the
 * user's own. Main decides with this on every write; the renderer asks it to offer a
 * choice, and main asks again.
 */

/** A gap this long without a snapshot ends an editing session. */
export const SESSION_GAP_MS = 45 * 60_000;

/** The work about to write a version. */
export type VersionWork =
  | SnapshotOccasion
  | 'before-restore'
  | 'before-import'
  | 'assistant'
  | 'name';

/** Editing still going on: the newest version is an automatic edit, taken recently. */
function isOpenSession(head: VersionMeta, now: number): boolean {
  return head.kind === 'auto' && head.source === 'edit' && now - head.createdAt < SESSION_GAP_MS;
}

/** What the user made by hand: a version they named, or their own editing, named or not. */
const USERS_OWN: ReadonlySet<VersionSource> = new Set<VersionSource>(['name', 'edit']);

/** Editing, and every snapshot that ends editing, adds to an open session. */
const ADDS_TO_HEAD: Record<VersionWork, (head: VersionMeta, now: number) => boolean> = {
  edit: isOpenSession,
  switched: isOpenSession,
  closed: isOpenSession,
  'before-apply': isOpenSession,
  'before-restore': isOpenSession,
  'before-import': isOpenSession,
  assistant: (head) => head.kind === 'auto' && head.source === 'assistant',
  name: (head) => USERS_OWN.has(head.source),
};

/** Whether `work` adds a revision to `head`, the template's newest version. */
export function canAddToVersion(head: VersionMeta, work: VersionWork, now: number): boolean {
  return ADDS_TO_HEAD[work](head, now);
}
