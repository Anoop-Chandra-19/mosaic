import type { ResumeEntry } from './resume';

/*
 * What the assistant proposes. Nothing here changes the draft: a proposal waits until the
 * user accepts it, and applying accepted ones is the user's gesture. Shared because main
 * stores proposals once the agent runs there; until then they live in the renderer.
 */

/**
 * One change, anchored to the text it was made against (`before`): the text the model
 * read, never the draft's text at staging time, so an edit made since shows as stale.
 */
export type ProposalChange =
  | {
      kind: 'rewrite';
      sectionId: string;
      entryId: string;
      bulletId: string;
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
      sectionId: string;
      /** Set: the entry's bullets. Absent: the section's entries. */
      entryId?: string;
      before: string[];
      after: string[];
    }
  | {
      kind: 'select';
      sectionId: string;
      entryId: string;
      bulletId: string;
      before: string;
      selected: boolean;
    }
  | {
      kind: 'entry';
      sectionId: string;
      /** Absent: the entry goes first. */
      afterEntryId?: string;
      /** Facts the user confirms field by field before it applies. */
      frame: Pick<ResumeEntry, 'title' | 'organization' | 'location' | 'dates'>;
      bullets: string[];
    };

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
  /** Its anchor no longer matches the draft. Rechecked both ways: an undo can bring it back. */
  isStale: boolean;
  flags: ProposalFlag[];
  /** The model's one-line reason, shown on the card. */
  reason?: string;
  /** The user's words for the request: a number they gave is not new. */
  requestText: string;
  createdAt: number;
}
