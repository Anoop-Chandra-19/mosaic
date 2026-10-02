import type { HeaderItemKind } from '../../types/resume';

/** The assistant writes these itself, so the short keys are what it is asked for. */
export type TextPhrase =
  | { k: 'keep'; t: string }
  | { k: 'edit'; id: string; del: string; ins: string };

export type ChangeKind = 'edit' | 'add' | 'remove' | 'show' | 'hide' | 'move';

/** A text-only section's line is a `summaryLine` in a summary section, a `textLine` in any other. */
export type ChangeTargetType =
  | 'name'
  | 'headerItem'
  | 'section'
  | 'entry'
  | 'entryField'
  | 'bullet'
  | 'summaryLine'
  | 'textLine';

export type EntryField = 'title' | 'organization' | 'location' | 'dates';

/** The editor field a change is about. Each id is set when the target has one. */
export interface ChangeTarget {
  type: ChangeTargetType;
  itemId?: string;
  itemKind?: HeaderItemKind;
  sectionId?: string;
  entryId?: string;
  bulletId?: string;
  field?: EntryField;
}

/** Where a thing stands: next to a neighbour, in a section, or alone in its list. */
export interface Placement {
  relation: 'above' | 'below' | 'in' | 'alone';
  /** The neighbour's or the section's name; empty when alone. */
  name: string;
}

export type ChangeTone = 'add' | 'del' | 'edit';

/**
 * One change from an earlier resume to a later one, or one the assistant proposes. History's
 * own changes (`origin: 'diff'`) are worked out after the fact, so their phrases are read-only.
 */
export interface Change {
  id: string;
  kind: ChangeKind;
  target: ChangeTarget;
  path: string;
  /** A bullet's or a text line's number on its page. */
  number: number | null;
  /** An entry's, a section's, or a text line's name in the wording. */
  displayName?: string;
  /** The text as each side prints it; empty where it doesn't print. */
  before: string;
  after: string;
  /** A long text's edit, word by word. A short field's edit has none: it shows whole. */
  phrases?: TextPhrase[];
  move?: { placement: Placement; placementBefore: Placement; isMovedUp: boolean };
  /** Inside an entry or section that itself came, went, or was hidden: drawn, not counted. */
  parentId?: string;
  origin: 'assistant' | 'diff';
  turn?: number;
}

const GLYPHS: Record<ChangeKind, string> = {
  edit: '~',
  add: '+',
  remove: '−',
  show: '+',
  hide: '−',
  move: '↕',
};

export const getChangeGlyph = (change: Change) => GLYPHS[change.kind];

export const isShortFieldChange = (change: Change) => change.kind === 'edit' && !change.phrases;

/** Whether a change adds to the page being read, takes from it, or edits it. */
export function getChangeTone(change: Change): ChangeTone {
  switch (change.kind) {
    case 'add':
    case 'show':
      return 'add';
    case 'remove':
    case 'hide':
      return 'del';
    case 'move':
      return 'edit';
    case 'edit':
      if (change.phrases) return 'edit';
      if (!change.before) return 'add';
      return change.after ? 'edit' : 'del';
  }
}

export function countChangesByTone(changes: readonly Change[]): Record<ChangeTone, number> {
  const counts: Record<ChangeTone, number> = { edit: 0, add: 0, del: 0 };
  for (const change of changes) counts[getChangeTone(change)]++;
  return counts;
}

/** "Work History › Analyst": a path less its bullet or line, which is what changes group by. */
export function trimPathToGroup(path: string): string {
  const parts = path.split(' › ').filter((part) => !/^(?:bullet|line) \d+/.test(part));
  return parts.join(' › ') || 'Header';
}

export const getChangeGroup = (change: Change) => trimPathToGroup(change.path);
