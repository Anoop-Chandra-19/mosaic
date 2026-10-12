import { versionLabel } from '@/features/history/versionLabel';
import { canAddToVersion } from '@shared/history/canAddToVersion';
import type { VersionMeta } from '@shared/types/db';
import type { HistoryChoice } from './historyChoice';

/** How a row draws, as the history list draws it. */
export type HistoryRowLook = 'assistant' | 'named' | 'before';

/** One row Apply will add to history, or the version it follows, for context. */
export interface HistoryRow {
  label: string;
  title: string;
  sub?: string;
  look: HistoryRowLook;
  /** Added by this apply; otherwise the row already there. */
  isNew: boolean;
}

interface HistoryRowsInput {
  /** The template's newest version, if it has one. */
  head: VersionMeta | undefined;
  draftRev: number;
  choice: HistoryChoice;
  /**
   * What the version will hold, "5 suggestions in Harbor Freight Labs": with Add to, what
   * the version it adds to held as well.
   */
  versionTitle: string;
  /** Versions after the assistant's edits are on, or the user named this one. */
  keepsVersions: boolean;
  now: number;
}

/**
 * The rows Apply adds, newest first, as main will write them: the draft kept before the
 * suggestions when it isn't kept yet (a revision of an editing session still open), then
 * the draft after them, a new number unless it adds to the assistant's version. The
 * assistant's version it follows comes last, faded.
 */
export function planHistoryRows({
  head,
  draftRev,
  choice,
  versionTitle,
  keepsVersions,
  now,
}: HistoryRowsInput): HistoryRow[] {
  if (!keepsVersions) return [];
  let nextNumber = (head?.number ?? 0) + 1;
  const rows: HistoryRow[] = [];

  const isDraftKept = !!head && head.rev === draftRev;
  if (!isDraftKept) {
    const isRevision = !!head && canAddToVersion(head, 'before-apply', now);
    rows.push({
      label: isRevision ? `v${head.number}.${head.revision + 1}` : `v${nextNumber++}`,
      title: 'Before applying suggestions',
      sub: isRevision ? `Last revision of v${head.number}` : undefined,
      look: 'before',
      isNew: true,
    });
  }

  const isAdding = choice.mode === 'add' && !!head;
  const isNamed = choice.mode === 'named';
  // A named version's own line says what it holds.
  const namedSub = isNamed ? versionTitle : undefined;
  rows.unshift({
    label: isAdding ? `v${head.number}.${head.revision + 1}` : `v${nextNumber}`,
    title: isNamed ? choice.name.trim() || 'Your name for it' : versionTitle,
    sub: isAdding ? `Revision of v${head.number}` : namedSub,
    look: isNamed ? 'named' : 'assistant',
    isNew: true,
  });

  if (head?.source === 'assistant') {
    rows.push({
      label: versionLabel(head),
      title: head.summary,
      look: head.kind === 'named' ? 'named' : 'assistant',
      isNew: false,
    });
  }
  return rows;
}
