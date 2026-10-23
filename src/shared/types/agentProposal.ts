import type { ResumeEntry } from './resume';

/*
 * What the assistant proposes. Nothing here changes the draft: a proposal waits until the
 * user accepts it, and applying accepted ones is the user's gesture. Shared because main
 * stores proposals once the agent runs there; until then they live in the renderer.
 */

/** Text the user wrote: a bullet of an entry, or a line of a lines section (its item). */
export type TextPlace =
  | { unit: 'bullet'; sectionId: string; entryId: string; bulletId: string }
  | { unit: 'line'; sectionId: string; lineId: string };

/** Anything that can be left off the page, or put back. */
export type ShowPlace =
  | TextPlace
  | { unit: 'entry'; sectionId: string; entryId: string }
  | { unit: 'section'; sectionId: string };

/** Where new text goes: a bullet into an entry, or a line into a lines section. */
export type AddPlace =
  | { unit: 'bullet'; sectionId: string; entryId: string }
  | { unit: 'line'; sectionId: string };

/** A list whose order can change: the sections, a section's items, or an entry's bullets. */
export type OrderPlace =
  | { unit: 'sections' }
  | { unit: 'items'; sectionId: string }
  | { unit: 'bullets'; sectionId: string; entryId: string };

/**
 * One change, anchored to the text it was made against (`before`): the text the model
 * read, never the draft's text at staging time, so an edit made since shows as stale.
 */
export type ProposalChange =
  | {
      kind: 'rewrite';
      place: TextPlace;
      before: string;
      after: string;
      /** The rewrite holds a `{{?}}` the user fills; this is the version that needs none. */
      gap?: { withoutNumber: string };
    }
  | {
      kind: 'split';
      sectionId: string;
      entryId: string;
      bulletId: string;
      before: string;
      at: number;
    }
  | {
      kind: 'merge';
      sectionId: string;
      entryId: string;
      firstId: string;
      secondId: string;
      before: [string, string];
      after: string;
    }
  | {
      kind: 'reorder';
      place: OrderPlace;
      before: string[];
      after: string[];
    }
  | {
      kind: 'select';
      place: ShowPlace;
      /** What the user sees of it: its text, an entry's heading, or a section's label. */
      before: string;
      selected: boolean;
    }
  | {
      kind: 'add';
      place: AddPlace;
      /** The bullet or line it goes after; null: it goes first. */
      afterId: string | null;
      text: string;
    }
  | {
      kind: 'entry';
      sectionId: string;
      /** Absent: the entry goes first. */
      afterEntryId?: string;
      /** Facts the user confirms field by field before it applies. */
      frame: Pick<ResumeEntry, EntryFact>;
      bullets: string[];
    };

/** A new entry's facts, which only the user can vouch for. */
export type EntryFact = 'title' | 'organization' | 'location' | 'dates';

/** Why the user dropped a suggestion, for the assistant's next turn. */
export type DropReason = 'inaccurate' | 'overstated' | 'wrongTone' | 'keepMyWording' | 'other';

/**
 * What the user did with a suggestion in review. The assistant's `change` stays as it was,
 * so "back to the assistant's wording" and "use it anyway" can be undone.
 */
export interface ProposalReview {
  /** Their own wording for a rewrite, merge or added text. */
  userText?: string;
  /**
   * Added text whose place is gone, put last by them instead: the item it now follows
   * (null when the list is empty).
   */
  placedAfterId?: string | null;
  /** The number they typed into the gap. */
  filledNumber?: string;
  /** They took the version that needs no number. */
  isWithoutNumber?: boolean;
  /** A new entry's facts they confirmed. */
  confirmedFacts?: EntryFact[];
  /** A new entry's facts as they corrected them. */
  factEdits?: Partial<Record<EntryFact, string>>;
  /**
   * Out of date, but they chose to review it against their edited bullet: its text now
   * (both texts for a merge), which the suggestion replaces instead.
   */
  rebasedBefore?: string | [string, string];
  dropReasons?: { reasons: DropReason[]; note?: string };
}

export type ProposalChangeKind = ProposalChange['kind'];

/** Which tool made it: `replace` makes ordinary rewrites, one per bullet it touches. */
export type ProposalSource = ProposalChangeKind | 'replace';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'applied';

/** What the local checks noticed, shown on the card. Only an unfilled gap blocks applying. */
export type ProposalFlagKind =
  | 'doubledWords'
  | 'claimsMore'
  | 'newNumbers'
  | 'calculatedNumbers'
  | 'removedDetail'
  | 'newNames'
  | 'unfilledGap';

export interface ProposalFlag {
  kind: ProposalFlagKind;
  /** The words or numbers it is about, as they appear in the text. */
  words: string[];
}

export interface Proposal {
  id: string;
  templateId: string;
  source: ProposalSource;
  change: ProposalChange;
  status: ProposalStatus;
  review: ProposalReview;
  /** Its anchor no longer matches the draft. Rechecked both ways: an undo can bring it back. */
  isStale: boolean;
  flags: ProposalFlag[];
  /** The model's one-line reason, shown on the card. */
  reason?: string;
  /** The user's words for the request: a number they gave is not new. */
  requestText: string;
  createdAt: number;
}
