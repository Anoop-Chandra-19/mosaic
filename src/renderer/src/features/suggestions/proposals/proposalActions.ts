import type {
  DropReason,
  NewContentIds,
  Proposal,
  ProposalChange,
  ProposalFlag,
  ProposalReview,
  ProposalSource,
  ProposalVersion,
} from '@/types/agentProposal';
import {
  findAnchorMismatch,
  findEntry,
  findSection,
  findTextItem,
  isEmptyNewSection,
  readAddedAmong,
} from '@/lib/resume/proposalAnchor';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import type { ResumeData } from '@shared/types/resume';
import { checkProposal } from './checks/checkProposal';
import { fillSuggestion, findSuggestionToFill } from './fillSuggestion';
import { canRewordSuggestion, readTextEdit, rewordChange, type TextEdit } from './rewordSuggestion';
import { createNewContentIds } from './newContentIds';
import {
  keepVersion,
  readActiveVersion,
  replaceVersion,
  returnToWaiting,
  updateActiveVersion,
} from './proposalVersions';
import { recheckOpenProposals, watchProposalAnchors } from './recheckProposals';
import {
  canKeepProposal,
  listNewEntries,
  resolveChange,
  resolveNewContentIds,
  reviewedRequestText,
  type EntryFactPlace,
} from './reviewedChange';
import { validateProposal, type ProposalRefusal } from './validateProposal';
import { buildCopyBefore, buildWorkingCopy, findRequiredIds, findTextWriter } from './workingCopy';

/*
 * Proposals are the assistant's suggested changes to the open draft. They wait for the
 * user to keep or drop them.
 *
 * A template's suggestions are one list, in the order they were made. `workingCopy.ts`
 * applies the waiting and kept ones to the draft in that order. The assistant reads and
 * edits that copy, so it can change text that an earlier suggestion wrote.
 *
 * A run stages changes here. `validateProposal` refuses a change that doesn't fit the
 * working copy, `newContentIds` assigns ids for additions, and `checks/checkProposal`
 * flags what the user should look at. When a change rewrites text that a waiting
 * suggestion wrote, `rewordSuggestion.ts` changes that suggestion and no new one is made.
 * When a change adds an entry or a line to a section that a waiting suggestion made, or a
 * bullet to an entry that one made, `fillSuggestion.ts` puts it into that suggestion.
 *
 * Each suggestion has one or more versions (`proposalVersions.ts`). The page, Preview and
 * Apply use the version the user kept, or the newest when they haven't kept one.
 *
 * The user keeps, drops or edits proposals. Their edits are stored in each version's
 * `review`, apart from the assistant's `change`, and `reviewedChange.ts` combines the two.
 * `recheckProposals` marks a suggestion stale when it no longer fits the copy built from
 * the suggestions before it, and current when it fits again.
 *
 * In `apply/`, `planApply` works out what Apply would do. `applyAcceptedProposals` does
 * it as one undo step and saves a version of the resume before and after.
 *
 * Other modules use this file, `proposalVersions.ts`, `workingCopy.ts`,
 * `apply/planApply.ts`, `apply/applyAcceptedProposals.ts`, `reviewedChange.ts` and
 * `describeSuggestion.ts`. The assistant's tools also use `validateProposal.ts` and
 * `checks/checkProposal.ts`, to check a change before they stage it,
 * `apply/applyProposalsToResume.ts`, to keep their own copy of the resume up to date, and
 * `listEmptySectionIds` in `fillSuggestion.ts`. The state is in `stores/proposalStore.ts`,
 * and only these files write to it.
 */

export interface StagedChange {
  change: ProposalChange;
  source: ProposalSource;
  reason?: string;
}

/** A waiting suggestion whose text a staged change rewrote. No new suggestion was made. */
export interface RewordedSuggestion {
  /** The position of that change in the staged list. */
  index: number;
  /** The suggestion as it was before the change. */
  before: Proposal;
  /** The suggestion with its new text. When it was removed, the suggestion as it was. */
  proposal: Proposal;
  /** True when the change put back the text the suggestion replaced, which removes it. */
  isRemoved: boolean;
}

/** A staged entry, line or bullet that was added to a waiting suggestion for a new section or entry. */
export interface FilledSuggestion {
  /** The position of that change in the staged list. */
  index: number;
  /** The suggestion as it was before the change. */
  before: Proposal;
  /** The suggestion with the new contents. */
  proposal: Proposal;
  /** The ids of the entry, line or bullet that went in. */
  filledIds: NewContentIds;
  /** What the checks found in the entry, line or bullet that went in. */
  filledFlags: ProposalFlag[];
}

export interface StagingResult {
  /** The new suggestions. */
  proposals: Proposal[];
  reworded: RewordedSuggestion[];
  filled: FilledSuggestion[];
  /** `index` is the refused change's position in the staged list, so a run can say which one to fix. */
  refusals: { index: number; refusal: ProposalRefusal }[];
}

function openTemplateId(): string {
  const id = useResumeStore.getState().templateId;
  if (id === null) throw new Error('Cannot change suggestions: no template is open');
  return id;
}

const listOpenProposals = () => useProposalStore.getState().byTemplate[openTemplateId()] ?? [];

/**
 * Find the waiting suggestion whose text a change rewrites. Returns null when the change
 * rewrites no text, or when the text is the user's. The user's text is the draft's text,
 * a kept suggestion's text, or their own wording on a card.
 */
function findSuggestionToReword(
  draft: ResumeData,
  proposals: readonly Proposal[],
  change: ProposalChange
): { writer: Proposal; edit: TextEdit } | null {
  const edit = readTextEdit(change);
  const writer = edit && findTextWriter(draft, proposals, edit.textId);
  return writer && canRewordSuggestion(writer, edit.textId) ? { writer, edit } : null;
}

/**
 * Add a later request to a suggestion's request text. A number the user gave in either
 * request is then not flagged as new.
 */
const joinRequestText = (earlier: string, later: string) =>
  earlier.includes(later) ? earlier : [earlier, later].filter(Boolean).join('\n');

/**
 * Run the checks on a version, with the user's edits in it. `copyBefore` is the resume with
 * the earlier suggestions applied, so the checks compare against the text the user sees.
 */
const checkReviewedVersion = (copyBefore: ResumeData, version: ProposalVersion): ProposalFlag[] =>
  checkProposal(
    copyBefore,
    resolveChange(version),
    reviewedRequestText(version),
    resolveNewContentIds(version)
  );

/** Change a suggestion's active version with `update`, then run the checks on it again. */
function updateAndCheckVersion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  proposal: Proposal,
  update: (version: ProposalVersion) => ProposalVersion
): Proposal {
  const updated = update(readActiveVersion(proposal));
  const copyBefore = buildCopyBefore(draft, proposals, proposal.id);
  return replaceVersion(proposal, { ...updated, flags: checkReviewedVersion(copyBefore, updated) });
}

/** Put new wording into the suggestion that wrote the text, and run its checks again. */
function rewordSuggestion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  { writer, edit }: { writer: Proposal; edit: TextEdit },
  requestText: string
): Omit<RewordedSuggestion, 'index'> {
  const change = rewordChange(readActiveVersion(writer), edit);
  if (!change) return { before: writer, proposal: writer, isRemoved: true };
  const reworded = updateAndCheckVersion(draft, proposals, writer, (version) => ({
    ...version,
    change,
    requestText: joinRequestText(version.requestText, requestText),
  }));
  return { before: writer, proposal: reworded, isRemoved: false };
}

/**
 * Add an entry, line or bullet to the waiting suggestion for the new section or entry it
 * goes in, then run that suggestion's checks again.
 */
function fillWaitingSuggestion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  suggestion: Proposal,
  change: ProposalChange,
  { requestText, isLate }: { requestText: string; isLate: boolean }
): Omit<FilledSuggestion, 'index' | 'filledFlags'> {
  const { filledIds, ...filled } = fillSuggestion(readActiveVersion(suggestion), change, isLate);
  const next = updateAndCheckVersion(draft, proposals, suggestion, (version) => ({
    ...version,
    ...filled,
    requestText: joinRequestText(version.requestText, requestText),
  }));
  return { before: suggestion, proposal: next, filledIds };
}

/**
 * Stage changes as proposals for the open draft. Each change is checked against the
 * working copy, which includes the changes staged before it in this call. A change that
 * doesn't fit is refused. Two kinds of change update a waiting suggestion instead of
 * making a new one: a rewrite of text that the suggestion wrote, and an entry, line or
 * bullet added to a new section or entry that the suggestion makes.
 *
 * `isFromThisRun` says whether the run staging these changes made a given suggestion.
 * When a change is added to a suggestion that an earlier run made, the card labels the
 * addition "just added".
 */
export function stageProposals(
  requestText: string,
  changes: StagedChange[],
  isFromThisRun: (proposalId: string) => boolean = () => true
): StagingResult {
  const templateId = openTemplateId();
  const draft = getResumeSnapshot();
  let proposals = listOpenProposals();
  const result: StagingResult = { proposals: [], reworded: [], filled: [], refusals: [] };
  const isMadeNow = (proposalId: string) =>
    isFromThisRun(proposalId) || result.proposals.some((each) => each.id === proposalId);
  changes.forEach(({ change, source, reason }, index) => {
    const copy = buildWorkingCopy(draft, proposals);
    const refusal = validateProposal(copy, change);
    if (refusal) {
      result.refusals.push({ index, refusal });
      return;
    }
    const toFill = findSuggestionToFill(proposals, change);
    if (toFill) {
      const filled = fillWaitingSuggestion(draft, proposals, toFill, change, {
        requestText,
        isLate: !isMadeNow(toFill.id),
      });
      const filledFlags = checkProposal(copy, change, requestText, filled.filledIds);
      result.filled.push({ index, ...filled, filledFlags });
      proposals = proposals.map((each) => (each.id === toFill.id ? filled.proposal : each));
      return;
    }
    const toReword = findSuggestionToReword(draft, proposals, change);
    if (toReword) {
      const reworded = rewordSuggestion(draft, proposals, toReword, requestText);
      result.reworded.push({ index, ...reworded });
      const { id } = reworded.proposal;
      proposals = reworded.isRemoved
        ? proposals.filter((each) => each.id !== id)
        : proposals.map((each) => (each.id === id ? reworded.proposal : each));
      return;
    }
    const newContentIds = createNewContentIds(change);
    const proposal: Proposal = {
      id: crypto.randomUUID(),
      templateId,
      source,
      versions: [
        {
          id: crypto.randomUUID(),
          change,
          newContentIds,
          review: {},
          flags: checkProposal(copy, change, requestText, newContentIds),
          reason,
          requestText,
          createdAt: Date.now(),
        },
      ],
      keptVersionId: null,
      status: 'pending',
      isStale: false,
    };
    result.proposals.push(proposal);
    proposals = [...proposals, proposal];
  });
  if (result.proposals.length || result.reworded.length || result.filled.length) {
    watchProposalAnchors();
    useProposalStore.getState().setProposals(templateId, proposals);
    // A dropped suggestion can start from the old wording. It is out of date now.
    if (result.reworded.length) recheckOpenProposals();
  }
  return result;
}

const findOpenProposals = (ids: readonly string[]) =>
  listOpenProposals().filter((proposal) => ids.includes(proposal.id));

/**
 * Keep the proposals that can be kept: current ones, with every fact of a new entry
 * confirmed. Also keep the earlier waiting suggestions they need, because a suggestion
 * that changes another suggestion's text can't apply without it.
 */
export function acceptProposals(ids: readonly string[]): void {
  const keepableIds = findOpenProposals(ids)
    .filter(canKeepProposal)
    .map((proposal) => proposal.id);
  const requiredIds = findRequiredIds(getResumeSnapshot(), listOpenProposals(), keepableIds);
  const keepableRequiredIds = findOpenProposals(requiredIds)
    .filter(canKeepProposal)
    .map((proposal) => proposal.id);
  const kept = findOpenProposals([...keepableIds, ...keepableRequiredIds]).map((proposal) =>
    keepVersion(proposal)
  );
  useProposalStore.getState().replaceProposals(openTemplateId(), kept);
}

/** Set these proposals back to waiting, with nothing kept. */
function returnOpenProposalsToWaiting(ids: readonly string[]): void {
  const waiting = findOpenProposals(ids).map(returnToWaiting);
  useProposalStore.getState().replaceProposals(openTemplateId(), waiting);
}

/** Drop the proposals. Later suggestions that changed their text become out of date. */
export function rejectProposals(ids: readonly string[]): void {
  useProposalStore.getState().setStatus(openTemplateId(), ids, 'rejected');
  recheckOpenProposals();
}

/**
 * Set kept proposals back to waiting when they change the text of a proposal that is
 * only waiting. Apply could not apply them, because it applies only kept proposals.
 */
function returnKeptThatNeedWaiting(): void {
  const draft = getResumeSnapshot();
  const proposals = listOpenProposals();
  const ids = proposals
    .filter((proposal) => proposal.status === 'accepted' && !proposal.isStale)
    .filter((proposal) => findRequiredIds(draft, proposals, [proposal.id]).length > 0)
    .map((proposal) => proposal.id);
  if (ids.length) returnOpenProposalsToWaiting(ids);
}

/**
 * Set the proposals back to waiting. This undoes a keep or a drop. Kept proposals that
 * change their text go back to waiting with them.
 */
export function returnProposals(ids: readonly string[]): void {
  returnOpenProposalsToWaiting(ids);
  recheckOpenProposals();
  returnKeptThatNeedWaiting();
}

/**
 * Remove proposals from review, as if they were never suggested. Without `ids`, remove
 * all of the open draft's proposals.
 */
export function discardProposals(ids?: readonly string[]): void {
  useProposalStore.getState().removeProposals(openTemplateId(), ids);
  recheckOpenProposals();
}

/**
 * Remove these proposals when they are new sections that are still empty. A run calls
 * this when it ends, because an empty section is never shown to the user. Returns the ids
 * of the proposals it removed. Every template is searched, as in `discardRunProposals`.
 */
export function discardEmptySections(ids: readonly string[]): string[] {
  const { byTemplate, removeProposals } = useProposalStore.getState();
  const removedIds: string[] = [];
  for (const [templateId, proposals] of Object.entries(byTemplate)) {
    const emptyIds = proposals
      .filter(
        (proposal) =>
          ids.includes(proposal.id) && isEmptyNewSection(readActiveVersion(proposal).change)
      )
      .map((proposal) => proposal.id);
    if (!emptyIds.length) continue;
    removeProposals(templateId, emptyIds);
    removedIds.push(...emptyIds);
  }
  if (removedIds.length) recheckOpenProposals();
  return removedIds;
}

/**
 * Undo what a run did to these proposals. A proposal the run made is removed from review.
 * A proposal from before the run, whose text the run changed, is put back as it was:
 * `suggestionsBeforeRun` holds those. Every template is searched, because a run's
 * proposals can belong to a resume that isn't open.
 */
export function discardRunProposals(
  ids: readonly string[],
  suggestionsBeforeRun: readonly Proposal[] = []
): void {
  const toPutBack = suggestionsBeforeRun.filter((proposal) => ids.includes(proposal.id));
  const idsToRemove = ids.filter((id) => !toPutBack.some((proposal) => proposal.id === id));
  const { byTemplate, replaceProposals, removeProposals } = useProposalStore.getState();
  for (const templateId of Object.keys(byTemplate)) {
    replaceProposals(templateId, toPutBack);
    removeProposals(templateId, idsToRemove);
  }
  recheckOpenProposals();
}

/**
 * Change one proposal with `update`, then check it against the copy built from the
 * suggestions before it. Returns false when the changed proposal is refused. Its flags
 * are recomputed for what it now writes.
 */
function reviewProposal(
  id: string,
  update: (proposal: Proposal, copyBefore: ResumeData) => Proposal | null
): boolean {
  const [proposal] = findOpenProposals([id]);
  if (!proposal) return false;
  const copyBefore = buildCopyBefore(getResumeSnapshot(), listOpenProposals(), id);
  const next = update(proposal, copyBefore);
  if (!next) return false;
  const version = readActiveVersion(next);
  const change = resolveChange(version);
  const isStale = findAnchorMismatch(copyBefore, change) !== null;
  if (!isStale && validateProposal(copyBefore, change)) return false;
  const checked = replaceVersion(next, {
    ...version,
    flags: checkReviewedVersion(copyBefore, version),
  });
  useProposalStore.getState().replaceProposals(openTemplateId(), [{ ...checked, isStale }]);
  recheckOpenProposals();
  if (proposal.status === 'accepted' && next.status === 'pending') returnKeptThatNeedWaiting();
  return true;
}

/** Some edits in review also keep the suggestion, or set it back to waiting. */
type ReviewDecision = 'keep' | 'returnToWaiting';

const DECIDE: Record<ReviewDecision, (proposal: Proposal) => Proposal> = {
  keep: (proposal) => keepVersion(proposal),
  returnToWaiting,
};

/** What the user has done so far to the suggestion's active version. */
const readReview = (proposal: Proposal): ProposalReview => readActiveVersion(proposal).review;

/**
 * Return a function that saves `patch` into the active version's review. With `decision`,
 * it also keeps the suggestion or sets it back to waiting.
 */
const withReview =
  (patch: ProposalReview, decision?: ReviewDecision) =>
  (proposal: Proposal): Proposal => {
    const reviewed = updateActiveVersion(proposal, (version) => ({
      ...version,
      review: { ...version.review, ...patch },
    }));
    return decision ? DECIDE[decision](reviewed) : reviewed;
  };

/** Save the user's own wording for the text a suggestion writes. Editing also keeps it. */
export function editProposal(id: string, text: string): boolean {
  return reviewProposal(id, withReview({ userText: text.trim() }, 'keep'));
}

/** Run the checks on the user's wording while they type it into a version. Nothing is saved. */
export function checkProposalEdit(
  proposal: Proposal,
  version: ProposalVersion,
  text: string
): ProposalFlag[] {
  const edited = { ...version, review: { ...version.review, userText: text.trim() } };
  const copyBefore = buildCopyBefore(getResumeSnapshot(), listOpenProposals(), proposal.id);
  return checkReviewedVersion(copyBefore, edited);
}

/** Remove the user's wording, so the suggestion writes the assistant's text again. */
export function clearProposalEdit(id: string): boolean {
  return reviewProposal(id, withReview({ userText: undefined }));
}

/**
 * Save the number the user typed into the gap. Only the user knows this number. Filling
 * it in also keeps the suggestion.
 */
export function fillProposalNumber(id: string, number: string): boolean {
  const filled = number.trim() || undefined;
  return reviewProposal(
    id,
    withReview({ filledNumber: filled, isWithoutNumber: false }, filled ? 'keep' : undefined)
  );
}

/** Choose the text that needs no number, or go back to the text with the gap. */
export function chooseTextWithoutNumber(id: string, isWithout: boolean): boolean {
  return reviewProposal(
    id,
    withReview(
      { isWithoutNumber: isWithout, filledNumber: undefined },
      isWithout ? 'keep' : undefined
    )
  );
}

/**
 * Save the number the user typed into the gap of a new entry's bullet. Unlike a rewrite's
 * number, this doesn't keep the suggestion: the entry's facts may still wait on the user.
 * An empty number takes the gap back to unfilled.
 */
export function fillBulletNumber(id: string, bulletId: string, number: string): boolean {
  return reviewProposal(id, (proposal) => {
    const filledNumbers = { ...readReview(proposal).filledNumbers };
    const filled = number.trim();
    if (filled) filledNumbers[bulletId] = filled;
    else delete filledNumbers[bulletId];
    return withReview({ filledNumbers })(proposal);
  });
}

/**
 * Choose the version of a new entry's bullet that needs no number, or go back to the
 * version with the gap. Either way, a number typed into the gap is cleared.
 */
export function chooseBulletWithoutNumber(
  id: string,
  bulletId: string,
  isWithout: boolean
): boolean {
  return reviewProposal(id, (proposal) => {
    const review = readReview(proposal);
    const others = (review.withoutNumberIds ?? []).filter((each) => each !== bulletId);
    const filledNumbers = { ...review.filledNumbers };
    delete filledNumbers[bulletId];
    return withReview({
      withoutNumberIds: isWithout ? [...others, bulletId] : others,
      filledNumbers,
    })(proposal);
  });
}

/** Return the facts confirmed for one new entry, with `fact` added or taken out. */
function setFactConfirmed(
  proposal: Proposal,
  { entryId, fact }: EntryFactPlace,
  isConfirmed: boolean
): ProposalReview['confirmedFacts'] {
  const confirmedFacts = readReview(proposal).confirmedFacts ?? {};
  const others = (confirmedFacts[entryId] ?? []).filter((each) => each !== fact);
  return { ...confirmedFacts, [entryId]: isConfirmed ? [...others, fact] : others };
}

/**
 * Confirm one fact of a new entry, or undo the confirmation. Undoing it sets a kept
 * suggestion back to waiting.
 */
export function confirmProposalFact(
  id: string,
  place: EntryFactPlace,
  isConfirmed: boolean
): boolean {
  return reviewProposal(id, (proposal) => {
    const confirmedFacts = setFactConfirmed(proposal, place, isConfirmed);
    const decision = !isConfirmed && proposal.status === 'accepted' ? 'returnToWaiting' : undefined;
    return withReview({ confirmedFacts }, decision)(proposal);
  });
}

/** Save one fact of a new entry in the user's words. This also confirms the fact. */
export function editProposalFact(id: string, place: EntryFactPlace, text: string): boolean {
  return reviewProposal(id, (proposal) => {
    const confirmedFacts = setFactConfirmed(proposal, place, true);
    const { factEdits = {} } = readReview(proposal);
    const entryEdits = { ...factEdits[place.entryId], [place.fact]: text.trim() };
    return withReview({ confirmedFacts, factEdits: { ...factEdits, [place.entryId]: entryEdits } })(
      proposal
    );
  });
}

/**
 * Leave one entry out of a suggested new section, keeping the other entries. Throws when
 * it is the last remaining entry, because the card never offers that: to leave out the
 * whole section, the user drops the suggestion.
 */
export function leaveEntryOut(id: string, entryId: string): boolean {
  return reviewProposal(id, (proposal) => {
    const entriesNotLeftOut = listNewEntries(readActiveVersion(proposal)).filter(
      (entry) => !entry.isLeftOut
    );
    const isAlreadyLeftOut = !entriesNotLeftOut.some((entry) => entry.ids.entryId === entryId);
    if (isAlreadyLeftOut) return null;
    if (entriesNotLeftOut.length === 1) {
      throw new Error(
        `Cannot leave out entry "${entryId}" of suggestion "${id}": it is the only entry not left out`
      );
    }
    const leftOutEntryIds = [...(readReview(proposal).leftOutEntryIds ?? []), entryId];
    return withReview({ leftOutEntryIds })(proposal);
  });
}

/** Put a left-out entry back into its new section. */
export function putEntryBack(id: string, entryId: string): boolean {
  return reviewProposal(id, (proposal) => {
    const leftOutEntryIds = (readReview(proposal).leftOutEntryIds ?? []).filter(
      (each) => each !== entryId
    );
    return withReview({ leftOutEntryIds })(proposal);
  });
}

/** Return the text a rewrite, merge or rename would replace now, read from `doc`. */
function readRebasedBefore(
  change: ProposalChange,
  doc: ResumeData
): ProposalReview['rebasedBefore'] | null {
  switch (change.kind) {
    case 'rewrite':
      return findTextItem(doc, change.place)?.text ?? null;
    case 'rename':
      return findSection(doc, change.sectionId)?.label ?? null;
    case 'merge': {
      const bullets = findEntry(doc, change.sectionId, change.entryId)?.bullets;
      const textOf = (bulletId: string) => bullets?.find((bullet) => bullet.id === bulletId)?.text;
      const [first, second] = [textOf(change.firstId), textOf(change.secondId)];
      return first !== undefined && second !== undefined ? [first, second] : null;
    }
    default:
      return null;
  }
}

/**
 * Move added text to the end of its entry or section. Used when the bullet or line it
 * was placed after no longer exists. The suggestion goes back to waiting.
 */
export function placeProposalLast(id: string): boolean {
  return reviewProposal(id, (proposal, copyBefore) => {
    const { change } = readActiveVersion(proposal);
    if (change.kind !== 'add') return null;
    const among = readAddedAmong(copyBefore, change.place);
    if (!among) return null;
    return withReview({ placedAfterId: among.at(-1) ?? null }, 'returnToWaiting')(proposal);
  });
}

/** Undo `placeProposalLast`. Its original place is gone, so it is out of date again. */
export function cancelPlacedLast(id: string): boolean {
  return reviewProposal(id, withReview({ placedAfterId: undefined }, 'returnToWaiting'));
}

/** Save the user's wording for a new section's heading. A heading is not a fact, so it needs no confirming. */
export function renameProposedSection(id: string, label: string): boolean {
  const sectionLabel = label.trim();
  if (!sectionLabel) return false;
  return reviewProposal(id, withReview({ sectionLabel }));
}

/**
 * Let the user review an out-of-date rewrite, merge or rename against the text as it is
 * now. The suggestion goes back to waiting. Keeping it replaces the user's edit.
 */
export function reviewStaleProposalAnyway(id: string): boolean {
  return reviewProposal(id, (proposal, copyBefore) => {
    const rebasedBefore = readRebasedBefore(readActiveVersion(proposal).change, copyBefore);
    if (!rebasedBefore) return null;
    return withReview({ rebasedBefore, userText: undefined }, 'returnToWaiting')(proposal);
  });
}

/** Undo `reviewStaleProposalAnyway`. The suggestion is out of date again. */
export function cancelStaleReview(id: string): boolean {
  return reviewProposal(
    id,
    withReview({ rebasedBefore: undefined, userText: undefined }, 'returnToWaiting')
  );
}

/** Save why the user dropped these proposals. The reasons are for the assistant's next run. */
export function setDropReasons(ids: readonly string[], reasons: DropReason[], note?: string): void {
  const dropReasons = { reasons, note: note?.trim() || undefined };
  useProposalStore.getState().replaceProposals(
    openTemplateId(),
    findOpenProposals(ids).map((proposal) => ({ ...proposal, dropReasons }))
  );
}
