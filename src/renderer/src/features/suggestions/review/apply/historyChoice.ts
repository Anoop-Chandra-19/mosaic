import { versionLabel } from '@/lib/versionLabel';
import { canAddToVersion } from '@shared/history/canAddToVersion';
import type { AppliedHistory, VersionMeta } from '@shared/types/db';

/** How Apply goes into history, as chosen beside the button. */
export interface HistoryChoice {
  mode: AppliedHistory['mode'];
  /** The name for "Name it", as typed. */
  name: string;
}

/** "Add to vN": offered after the assistant's own version, with why when it can't be used. */
export interface AddToOffer {
  /** The version it would add to: "v12". */
  label: string;
  /** What adding would save it as: "v12.1". */
  revisionLabel: string;
  refusal: string | null;
}

/**
 * Add to is for the assistant's newest version, while the draft still matches it, so the
 * user's own edits never end up inside an assistant version.
 */
export function readAddToOffer(head: VersionMeta | undefined, draftRev: number): AddToOffer | null {
  if (!head || head.source !== 'assistant') return null;
  const label = versionLabel(head);
  const revisionLabel = `v${head.number}.${head.revision + 1}`;
  if (!canAddToVersion(head, 'assistant', Date.now())) {
    return { label, revisionLabel, refusal: `${label} is named, so it can’t be added to.` };
  }
  if (head.rev !== draftRev) {
    return {
      label,
      revisionLabel,
      refusal: `Your draft changed since ${label}, so it can’t be added to.`,
    };
  }
  return { label, revisionLabel, refusal: null };
}

/** Adding to the turn's version when it can; its own version otherwise. */
export function chooseDefaultHistory(offer: AddToOffer | null): HistoryChoice {
  return { mode: offer && !offer.refusal ? 'add' : 'new', name: '' };
}

/** "Name it" can't go without a name. */
export const isMissingName = (choice: HistoryChoice) =>
  choice.mode === 'named' && !choice.name.trim();

export function toAppliedHistory(choice: HistoryChoice): AppliedHistory {
  return choice.mode === 'named'
    ? { mode: 'named', name: choice.name.trim() }
    : { mode: choice.mode };
}
