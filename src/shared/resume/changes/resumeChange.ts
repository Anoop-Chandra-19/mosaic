import type { HeaderItemKind } from '../../types/resume';
import type { TextPhrase } from './changePhrases';

export type ChangeKind =
  | 'rewrite'
  | 'add'
  | 'remove'
  | 'toggle'
  | 'reorder'
  | 'subtitle'
  | 'rename';

/** A text-only section's line is `summary` in a summary section and `text` in any other. */
export type ChangeLine =
  | 'name'
  | 'item'
  | 'section'
  | 'entry'
  | 'field'
  | 'bullet'
  | 'summary'
  | 'text';

export type EntryField = 'title' | 'organization' | 'location' | 'dates';

export type ChangeTone = 'add' | 'del' | 'edit';

/**
 * One change between two resumes, or one the assistant proposes. History's own changes
 * (`origin: 'diff'`) are worked out after the fact, so their phrases are read-only.
 */
export interface Change {
  id: string;
  kind: ChangeKind;
  line: ChangeLine;
  field?: EntryField;
  itemKind?: HeaderItemKind;
  sectionId: string | null;
  entryId: string | null;
  bulletId: string | null;
  where: string;
  /** A bullet's or a text line's number on its page. */
  n?: number | null;
  label?: string;
  phrases?: TextPhrase[];
  /** Short fields are shown whole, never word by word. */
  from?: string;
  to?: string;
  text?: string;
  /** A toggle: true when it is on the page being read, and off it on the other side. */
  isOnPage?: boolean;
  rel?: 'above' | 'below' | 'to';
  other?: string;
  was?: string;
  isMovedUp?: boolean;
  /** Inside an entry or section that itself came, went, or was hidden: drawn, not counted. */
  isChild?: boolean;
  parentKey?: string;
  origin: 'assistant' | 'diff';
  turn?: number;
}

const GLYPHS: Record<ChangeKind, string> = {
  rewrite: '~',
  subtitle: '~',
  rename: '~',
  add: '+',
  remove: '−',
  toggle: '~',
  reorder: '↕',
};

export function getChangeGlyph(change: Change): string {
  if (change.kind === 'toggle') return change.isOnPage ? '+' : '−';
  return GLYPHS[change.kind];
}

/** Whether a change adds to the page being read, takes from it, or edits it. */
export function getChangeTone(change: Change): ChangeTone {
  if (!change.phrases && change.from !== undefined && change.kind !== 'toggle') {
    return !change.from ? 'add' : !change.to ? 'del' : 'edit';
  }
  if (change.kind === 'add' || (change.kind === 'toggle' && change.isOnPage)) return 'add';
  if (change.kind === 'remove' || change.kind === 'toggle') return 'del';
  return 'edit';
}

export function countChangesByTone(changes: readonly Change[]): Record<ChangeTone, number> {
  const counts: Record<ChangeTone, number> = { edit: 0, add: 0, del: 0 };
  for (const change of changes) counts[getChangeTone(change)]++;
  return counts;
}

export function getChangeGroup(change: Change): string {
  const parts = change.where.split(' › ').filter((part) => !/^(?:bullet|line) \d+/.test(part));
  return parts.join(' › ') || 'Header';
}
