import type { ResumeEntry, SectionKind, SectionLayout } from '@shared/types/resume';

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
 * A number only the user knows, which the text leaves as `{{?}}` for them to fill.
 * `withoutNumber` is the same text written so that it needs no number.
 */
export interface NumberGap {
  withoutNumber: string;
}

/** A new entry's facts and its bullets, which the user confirms field by field. */
export interface EntryDraft {
  frame: Pick<ResumeEntry, EntryFact>;
  bullets: string[];
  /**
   * The bullets that hold a `{{?}}` for the user to fill, by the bullet's new id. The ids
   * are set at staging, so a bullet put in before another doesn't move its gap.
   */
  gaps?: Record<string, NumberGap>;
}

/** What a new section holds: entries for an entries section, lines for a lines section. */
export type SectionContents =
  | { layout: 'entries'; entries: EntryDraft[] }
  | { layout: 'lines'; lines: string[] };

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
      gap?: NumberGap;
    }
  | {
      kind: 'split';
      sectionId: string;
      entryId: string;
      bulletId: string;
      before: string;
      at: number;
      /**
       * The text of the two bullets. It is set only when the assistant reworded one of
       * them after the split. Without it, the two bullets are `before` cut at `at`.
       */
      halves?: [string, string];
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
      /** Set when `text` contains a `{{?}}` for the user to fill. It is the text that needs no number. */
      gap?: NumberGap;
    }
  | {
      kind: 'entry';
      sectionId: string;
      /** Absent: the entry goes first. */
      afterEntryId?: string;
      /** Facts the user confirms field by field before it applies. */
      frame: Pick<ResumeEntry, EntryFact>;
      bullets: string[];
      /** The bullets that hold a `{{?}}`, by the bullet's new id, as in `EntryDraft`. */
      gaps?: Record<string, NumberGap>;
    }
  | {
      kind: 'section';
      /** The section it goes after; null: it goes first. */
      afterSectionId: string | null;
      /** A preset of the Add section menu, or `custom` with the layout its contents need. */
      section: { kind: SectionKind; layout: SectionLayout; label: string };
      /**
       * Its entries or its lines. Null while the assistant has made the section but
       * put nothing in it yet. An empty section is not shown in review and can't be kept.
       * An empty custom section has the lines layout until its first contents decide.
       */
      contents: SectionContents | null;
    }
  | {
      kind: 'rename';
      sectionId: string;
      before: string;
      after: string;
    };

/** Ids for a new entry and each of its bullets. */
export interface NewEntryIds {
  entryId: string;
  bulletIds: string[];
}

/**
 * Ids for the new things a change adds. They are set at staging, so the review, the
 * preview and the applied draft all use the same ids. An empty bullet or line is not
 * added, so its id is never used.
 */
export type NewContentIds =
  | { kind: 'split'; secondBulletId: string }
  /** The id of the new bullet or line. */
  | { kind: 'add'; id: string }
  | { kind: 'entry'; entry: NewEntryIds }
  | {
      kind: 'section';
      sectionId: string;
      /** One id per line, or the ids of each entry. Null while the section is empty. */
      contents:
        | { layout: 'entries'; entries: NewEntryIds[] }
        | { layout: 'lines'; lineIds: string[] }
        | null;
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
  /** Their own wording for a rewrite, merge, added text or heading. */
  userText?: string;
  /** A new section's heading as they changed it: their words, nothing to confirm. */
  sectionLabel?: string;
  /**
   * Added text whose place is gone, put last by them instead: the item it now follows
   * (null when the list is empty).
   */
  placedAfterId?: string | null;
  /** The number they typed into the gap of a rewrite or added text. */
  filledNumber?: string;
  /** They took the version of a rewrite or added text that needs no number. */
  isWithoutNumber?: boolean;
  /** The numbers they typed into the gaps of a new entry's bullets, by bullet id. */
  filledNumbers?: Record<string, string>;
  /** The bullets of a new entry whose version without a number they took. */
  withoutNumberIds?: string[];
  /**
   * The facts they confirmed, by the id of the new entry they belong to. The entry is a new
   * entry on its own, or one of a new section's entries.
   */
  confirmedFacts?: Record<string, EntryFact[]>;
  /** The facts they corrected, by the id of the new entry they belong to. */
  factEdits?: Record<string, Partial<Record<EntryFact, string>>>;
  /** The entries of a new section they left out. The rest of the section is kept or dropped. */
  leftOutEntryIds?: string[];
  /**
   * Out of date, but they chose to review it against their edited bullet: its text now
   * (both texts for a merge), which the suggestion replaces instead.
   */
  rebasedBefore?: string | [string, string];
}

/** Why the user dropped a suggestion, and any note they wrote. The assistant reads it next turn. */
export interface DropReasons {
  reasons: DropReason[];
  note?: string;
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
  /**
   * The id of the new entry's bullet it is about. Absent when it is about the whole change:
   * any change other than a new entry or a new section of entries.
   */
  textId?: string;
}

/**
 * One version of a suggestion: the change, and the user's edits to it. A suggestion gets a
 * new version when the assistant changes something the user already kept. These are not
 * the saved versions of a resume in its history.
 */
export interface ProposalVersion {
  id: string;
  change: ProposalChange;
  /** Null when the change adds nothing new. */
  newContentIds: NewContentIds | null;
  /** The user's edits to this version. */
  review: ProposalReview;
  flags: ProposalFlag[];
  /** The model's one-line reason, shown on the card. */
  reason?: string;
  /** The user's words for the request: a number they gave is not new. */
  requestText: string;
  createdAt: number;
  /**
   * The ids of entries and bullets that a later run added to this version while it was
   * waiting. The card labels them "just added". Additions from the run that made the
   * version aren't listed, because the user hadn't seen it yet.
   */
  lateIds?: string[];
}

export interface Proposal {
  id: string;
  templateId: string;
  source: ProposalSource;
  /** Oldest first. Never empty. */
  versions: ProposalVersion[];
  /**
   * The version the user kept. It stays set while the suggestion is dropped, so undoing the
   * drop brings that version back as kept. Null when they haven't kept one.
   */
  keptVersionId: string | null;
  /**
   * `pending`: nothing is kept. `accepted`: the version `keptVersionId` names is kept.
   * `rejected`: the user dropped the whole suggestion.
   */
  status: ProposalStatus;
  /** Its anchor no longer matches the draft. Rechecked both ways: an undo can bring it back. */
  isStale: boolean;
  /** Why the user dropped it, when they said. It belongs to the suggestion, since a drop drops every version. */
  dropReasons?: DropReasons;
}
