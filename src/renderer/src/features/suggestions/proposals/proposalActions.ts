import type {
  DropReason,
  EntryFact,
  NewContentIds,
  Proposal,
  ProposalChange,
  ProposalFlag,
  ProposalReview,
  ProposalSource,
  ProposalStatus,
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
import { fillSection, findSectionToFill } from './fillSuggestedSection';
import { canRewordSuggestion, readTextEdit, rewordChange, type TextEdit } from './rewordSuggestion';
import { createNewContentIds } from './newContentIds';
import { recheckOpenProposals, watchProposalAnchors } from './recheckProposals';
import { canKeepProposal, resolveChange, reviewedRequestText } from './reviewedChange';
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
 * When a change adds a line or a first entry to a section that a waiting suggestion made,
 * `fillSuggestedSection.ts` puts it into that suggestion.
 *
 * The user keeps, drops or edits proposals. Their edits are stored in `review`, apart from
 * the assistant's `change`, and `reviewedChange.ts` combines the two. `recheckProposals`
 * marks a suggestion stale when it no longer fits the copy built from the suggestions
 * before it, and current when it fits again.
 *
 * In `apply/`, `planApply` works out what Apply would do. `applyAcceptedProposals` does
 * it as one undo step and saves a version before and after.
 *
 * Other modules use this file, `workingCopy.ts`, `apply/planApply.ts`,
 * `apply/applyAcceptedProposals.ts`, `reviewedChange.ts` and `describeSuggestion.ts`. The
 * state is in `stores/proposalStore.ts`, and only these files write to it.
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

/** A waiting suggestion for a new section that a staged line or entry went into. */
export interface FilledSuggestion {
  /** The position of that change in the staged list. */
  index: number;
  /** The section's suggestion as it was before the change. */
  before: Proposal;
  /** The section's suggestion with the new contents. */
  proposal: Proposal;
  /** The ids of the line or entry that went in. */
  filledIds: NewContentIds;
  /** What the checks found in the line or entry that went in. */
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
 * Put new wording into the suggestion that wrote the text, and run its checks again. The
 * checks compare against the copy built from the suggestions before it, which holds the
 * user's text.
 */
function rewordSuggestion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  { writer, edit }: { writer: Proposal; edit: TextEdit },
  requestText: string
): Omit<RewordedSuggestion, 'index'> {
  const change = rewordChange(writer, edit);
  if (!change) return { before: writer, proposal: writer, isRemoved: true };
  const reworded = {
    ...writer,
    change,
    requestText: joinRequestText(writer.requestText, requestText),
  };
  const copyBefore = buildCopyBefore(draft, proposals, writer.id);
  const flags = checkProposal(copyBefore, resolveChange(reworded), reviewedRequestText(reworded));
  return { before: writer, proposal: { ...reworded, flags }, isRemoved: false };
}

/**
 * Put a line or an entry into the suggestion that made its section, and run that
 * suggestion's checks again.
 */
function fillSuggestedSection(
  draft: ResumeData,
  proposals: readonly Proposal[],
  section: Proposal,
  change: ProposalChange,
  requestText: string
): Omit<FilledSuggestion, 'index' | 'filledFlags'> {
  const { filledIds, ...filled } = fillSection(section, change);
  const next = {
    ...section,
    ...filled,
    requestText: joinRequestText(section.requestText, requestText),
  };
  const copyBefore = buildCopyBefore(draft, proposals, section.id);
  const flags = checkProposal(copyBefore, resolveChange(next), reviewedRequestText(next));
  return { before: section, proposal: { ...next, flags }, filledIds };
}

/**
 * Stage changes as proposals for the open draft. Each change is checked against the
 * working copy, which includes the changes staged before it in this call. A change that
 * doesn't fit is refused. Two kinds of change go into a waiting suggestion, and no new one
 * is made: a rewrite of text the suggestion wrote, and a line or first entry for a
 * section the suggestion made.
 */
export function stageProposals(requestText: string, changes: StagedChange[]): StagingResult {
  const templateId = openTemplateId();
  const draft = getResumeSnapshot();
  let proposals = listOpenProposals();
  const result: StagingResult = { proposals: [], reworded: [], filled: [], refusals: [] };
  changes.forEach(({ change, source, reason }, index) => {
    const copy = buildWorkingCopy(draft, proposals);
    const refusal = validateProposal(copy, change);
    if (refusal) {
      result.refusals.push({ index, refusal });
      return;
    }
    const sectionToFill = findSectionToFill(proposals, change);
    if (sectionToFill) {
      const filled = fillSuggestedSection(draft, proposals, sectionToFill, change, requestText);
      const filledFlags = checkProposal(copy, change, requestText);
      result.filled.push({ index, ...filled, filledFlags });
      proposals = proposals.map((each) => (each.id === sectionToFill.id ? filled.proposal : each));
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
    const proposal: Proposal = {
      id: crypto.randomUUID(),
      templateId,
      source,
      change,
      newContentIds: createNewContentIds(change),
      status: 'pending',
      review: {},
      isStale: false,
      flags: checkProposal(copy, change, requestText),
      reason,
      requestText,
      createdAt: Date.now(),
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
  useProposalStore
    .getState()
    .setStatus(openTemplateId(), [...keepableIds, ...keepableRequiredIds], 'accepted');
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
  if (ids.length) useProposalStore.getState().setStatus(openTemplateId(), ids, 'pending');
}

/**
 * Set the proposals back to waiting. This undoes a keep or a drop. Kept proposals that
 * change their text go back to waiting with them.
 */
export function returnProposals(ids: readonly string[]): void {
  useProposalStore.getState().setStatus(openTemplateId(), ids, 'pending');
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
      .filter((proposal) => ids.includes(proposal.id) && isEmptyNewSection(proposal.change))
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
  const change = resolveChange(next);
  const isStale = findAnchorMismatch(copyBefore, change) !== null;
  if (!isStale && validateProposal(copyBefore, change)) return false;
  const flags = checkProposal(copyBefore, change, reviewedRequestText(next));
  useProposalStore.getState().replaceProposals(openTemplateId(), [{ ...next, isStale, flags }]);
  recheckOpenProposals();
  if (proposal.status === 'accepted' && next.status === 'pending') returnKeptThatNeedWaiting();
  return true;
}

const withReview =
  (patch: ProposalReview, status?: ProposalStatus) =>
  (proposal: Proposal): Proposal => ({
    ...proposal,
    review: { ...proposal.review, ...patch },
    status: status ?? proposal.status,
  });

/** Save the user's own wording for the text a suggestion writes. Editing also keeps it. */
export function editProposal(id: string, text: string): boolean {
  return reviewProposal(id, withReview({ userText: text.trim() }, 'accepted'));
}

/** Return the flags the checks would give the user's wording. Called as they type. */
export function checkProposalEdit(proposal: Proposal, text: string): ProposalFlag[] {
  const edited = withReview({ userText: text.trim() })(proposal);
  const copyBefore = buildCopyBefore(getResumeSnapshot(), listOpenProposals(), proposal.id);
  return checkProposal(copyBefore, resolveChange(edited), reviewedRequestText(edited));
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
    withReview({ filledNumber: filled, isWithoutNumber: false }, filled ? 'accepted' : undefined)
  );
}

/** Choose the version that needs no number, or go back to the version with the gap. */
export function chooseVersionWithoutNumber(id: string, isWithout: boolean): boolean {
  return reviewProposal(
    id,
    withReview(
      { isWithoutNumber: isWithout, filledNumber: undefined },
      isWithout ? 'accepted' : undefined
    )
  );
}

/**
 * Confirm one fact of a new entry, or undo the confirmation. Undoing it sets a kept
 * entry back to waiting.
 */
export function confirmProposalFact(id: string, fact: EntryFact, isConfirmed: boolean): boolean {
  return reviewProposal(id, (proposal) => {
    const others = (proposal.review.confirmedFacts ?? []).filter((each) => each !== fact);
    const confirmedFacts = isConfirmed ? [...others, fact] : others;
    const status = !isConfirmed && proposal.status === 'accepted' ? 'pending' : undefined;
    return withReview({ confirmedFacts }, status)(proposal);
  });
}

/** Save one fact of a new entry in the user's words. This also confirms the fact. */
export function editProposalFact(id: string, fact: EntryFact, text: string): boolean {
  return reviewProposal(id, (proposal) => {
    const confirmedFacts = [
      ...(proposal.review.confirmedFacts ?? []).filter((each) => each !== fact),
      fact,
    ];
    const factEdits = { ...proposal.review.factEdits, [fact]: text.trim() };
    return withReview({ confirmedFacts, factEdits })(proposal);
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
    const { change } = proposal;
    if (change.kind !== 'add') return null;
    const among = readAddedAmong(copyBefore, change.place);
    if (!among) return null;
    return withReview({ placedAfterId: among.at(-1) ?? null }, 'pending')(proposal);
  });
}

/** Undo `placeProposalLast`. Its original place is gone, so it is out of date again. */
export function cancelPlacedLast(id: string): boolean {
  return reviewProposal(id, withReview({ placedAfterId: undefined }, 'pending'));
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
    const rebasedBefore = readRebasedBefore(proposal.change, copyBefore);
    if (!rebasedBefore) return null;
    return withReview({ rebasedBefore, userText: undefined }, 'pending')(proposal);
  });
}

/** Undo `reviewStaleProposalAnyway`. The suggestion is out of date again. */
export function cancelStaleReview(id: string): boolean {
  return reviewProposal(
    id,
    withReview({ rebasedBefore: undefined, userText: undefined }, 'pending')
  );
}

/** Save why the user dropped these proposals. The reasons are for the assistant's next run. */
export function setDropReasons(ids: readonly string[], reasons: DropReason[], note?: string): void {
  const dropReasons = { reasons, note: note?.trim() || undefined };
  useProposalStore.getState().replaceProposals(
    openTemplateId(),
    findOpenProposals(ids).map((proposal) => withReview({ dropReasons })(proposal))
  );
}
