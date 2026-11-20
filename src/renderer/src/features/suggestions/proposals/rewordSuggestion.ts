import { readTextPlaceId } from '@/lib/resume/proposalAnchor';
import { cutSplitHalves, readSplitHalves } from '@/lib/resume/splitHalves';
import type {
  EntryDraft,
  NewEntryIds,
  NumberGap,
  Proposal,
  ProposalChange,
  ProposalVersion,
} from '@/types/agentProposal';
import { readActiveVersion } from './proposalVersions';
import { resolveChange } from './reviewedChange';

/*
 * Change the text of a waiting suggestion when the assistant rewrites it.
 *
 * The assistant can rewrite text that a waiting suggestion wrote. That rewrite does not
 * become a second suggestion. It changes the text in the first one. The card then shows
 * the user's text beside the newest wording, and the checks compare against the user's
 * text.
 *
 * Staging calls `readTextEdit` to see whether a change rewrites text. It calls
 * `findTextWriter` in `workingCopy.ts` to find the suggestion that wrote the text. It
 * calls `canRewordSuggestion` and `rewordChange` to change that suggestion.
 */

/** New wording for one bullet, line or section heading. */
export interface TextEdit {
  /** The id of the bullet or line. For a heading, the id of its section. */
  textId: string;
  text: string;
  /** Set when `text` holds a `{{?}}`. It is the version that needs no number. */
  gap?: NumberGap;
}

/** Return the new wording a rewrite or rename gives. Returns null for any other change. */
export function readTextEdit(change: ProposalChange): TextEdit | null {
  switch (change.kind) {
    case 'rewrite':
      return { textId: readTextPlaceId(change.place), text: change.after, gap: change.gap };
    case 'rename':
      return { textId: change.sectionId, text: change.after };
    default:
      return null;
  }
}

/** Return the ids of the bullets, lines and section headings whose text a version writes. */
export function listWrittenTextIds({ change, newContentIds }: ProposalVersion): string[] {
  switch (change.kind) {
    case 'rewrite':
      return [readTextPlaceId(change.place)];
    case 'rename':
      return [change.sectionId];
    case 'merge':
      return [change.firstId];
    case 'split':
      return newContentIds?.kind === 'split'
        ? [change.bulletId, newContentIds.secondBulletId]
        : [change.bulletId];
    case 'add':
      return newContentIds?.kind === 'add' ? [newContentIds.id] : [];
    case 'entry':
      return newContentIds?.kind === 'entry' ? newContentIds.entry.bulletIds : [];
    case 'section': {
      if (newContentIds?.kind !== 'section') return [];
      const { sectionId, contents } = newContentIds;
      if (contents === null) return [sectionId];
      return [
        sectionId,
        ...(contents.layout === 'lines'
          ? contents.lineIds
          : contents.entries.flatMap((entry) => entry.bulletIds)),
      ];
    }
    case 'reorder':
    case 'select':
      return [];
  }
}

/** Check whether the user wrote this text on the card themselves, in review. */
function isUserWording({ review, newContentIds }: ProposalVersion, textId: string): boolean {
  if (newContentIds?.kind === 'section' && newContentIds.sectionId === textId) {
    return review.sectionLabel !== undefined;
  }
  // A new entry's bullet whose number the user filled, or whose version without one they took.
  if (review.filledNumbers?.[textId] || review.withoutNumberIds?.includes(textId)) return true;
  return review.userText !== undefined || !!review.filledNumber || !!review.isWithoutNumber;
}

/**
 * Check whether a rewrite of this text changes the suggestion that wrote it. It does when
 * the suggestion is waiting and the text is the assistant's. A rewrite of a kept
 * suggestion's text, or of the user's own wording on a card, is a new suggestion.
 */
export const canRewordSuggestion = (proposal: Proposal, textId: string) =>
  proposal.status === 'pending' && !isUserWording(readActiveVersion(proposal), textId);

function failToFindText(version: ProposalVersion, textId: string): never {
  throw new Error(
    `Expected suggestion version "${version.id}" (${version.change.kind}) to write text "${textId}", found no such text in it`
  );
}

const replaceAt = (texts: readonly string[], index: number, text: string) =>
  texts.map((each, position) => (position === index ? text : each));

/**
 * Return a new entry with one bullet reworded. Its gap follows the new wording: kept when
 * the new wording has a number to fill, gone when it hasn't. Returns null when the bullet
 * isn't in the entry.
 */
function rewordEntryBullet<T extends EntryDraft>(
  entry: T,
  ids: NewEntryIds,
  edit: TextEdit
): T | null {
  const index = ids.bulletIds.indexOf(edit.textId);
  if (index < 0) return null;
  const gaps = { ...entry.gaps };
  if (edit.gap) gaps[edit.textId] = edit.gap;
  else delete gaps[edit.textId];
  return {
    ...entry,
    bullets: replaceAt(entry.bullets, index, edit.text),
    gaps: Object.keys(gaps).length ? gaps : undefined,
  };
}

type SectionChange = Extract<ProposalChange, { kind: 'section' }>;

/** Reword a new section's heading, one of its lines, or one bullet of one of its entries. */
function rewordSection(change: SectionChange, version: ProposalVersion, edit: TextEdit) {
  const ids = version.newContentIds;
  if (ids?.kind !== 'section') return null;
  if (ids.sectionId === edit.textId) {
    return { ...change, section: { ...change.section, label: edit.text } };
  }
  const { contents } = change;
  if (contents?.layout === 'lines' && ids.contents?.layout === 'lines') {
    const index = ids.contents.lineIds.indexOf(edit.textId);
    if (index < 0) return null;
    const lines = replaceAt(contents.lines, index, edit.text);
    return { ...change, contents: { ...contents, lines } };
  }
  if (contents?.layout === 'entries' && ids.contents?.layout === 'entries') {
    const entryIds = ids.contents.entries;
    const index = entryIds.findIndex((each) => each.bulletIds.includes(edit.textId));
    if (index < 0) return null;
    const reworded = rewordEntryBullet(contents.entries[index], entryIds[index], edit);
    if (!reworded) return null;
    const entries = contents.entries.map((entry, position) =>
      position === index ? reworded : entry
    );
    return { ...change, contents: { ...contents, entries } };
  }
  return null;
}

type SplitChange = Extract<ProposalChange, { kind: 'split' }>;

/**
 * Reword one of the two bullets a split makes. `halves` is cleared when both bullets
 * read the same as the plain cut again.
 */
function rewordSplitHalf(change: SplitChange, edit: TextEdit): SplitChange {
  const index = edit.textId === change.bulletId ? 0 : 1;
  const [first, second] = replaceAt(readSplitHalves(change), index, edit.text.trim());
  const [cutFirst, cutSecond] = cutSplitHalves(change);
  const isPlainCut = first === cutFirst && second === cutSecond;
  return { ...change, halves: isPlainCut ? undefined : [first, second] };
}

/**
 * Return the suggestion's change with the new wording in it. Returns null when the new
 * wording is the text the suggestion replaced, because then nothing is left to suggest.
 */
export function rewordChange(version: ProposalVersion, edit: TextEdit): ProposalChange | null {
  const { change } = version;
  switch (change.kind) {
    case 'rewrite': {
      const reviewed = resolveChange(version);
      const isUndone = reviewed.kind === 'rewrite' && edit.text.trim() === reviewed.before;
      return isUndone ? null : { ...change, after: edit.text, gap: edit.gap };
    }
    case 'rename': {
      const reviewed = resolveChange(version);
      const isUndone = reviewed.kind === 'rename' && edit.text.trim() === reviewed.before;
      return isUndone ? null : { ...change, after: edit.text };
    }
    case 'merge':
      return { ...change, after: edit.text };
    case 'add':
      return { ...change, text: edit.text, gap: edit.gap };
    case 'split':
      return rewordSplitHalf(change, edit);
    case 'entry': {
      const ids = version.newContentIds;
      const reworded = ids?.kind === 'entry' ? rewordEntryBullet(change, ids.entry, edit) : null;
      return reworded ?? failToFindText(version, edit.textId);
    }
    case 'section':
      return rewordSection(change, version, edit) ?? failToFindText(version, edit.textId);
    case 'reorder':
    case 'select':
      return failToFindText(version, edit.textId);
  }
}
