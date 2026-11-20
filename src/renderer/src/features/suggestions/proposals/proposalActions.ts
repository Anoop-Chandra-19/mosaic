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
import { readTextEdit, rewordChange, type TextEdit } from './rewordSuggestion';
import { createNewContentIds } from './newContentIds';
import { buildNextVersion, findVersionToChange, type VersionToChange } from './nextVersion';
import {
  addVersion,
  findVersion,
  keepVersion,
  readActiveVersion,
  replaceVersion,
  returnToWaiting,
  undoDecision,
} from './proposalVersions';
import { recheckOpenProposals, watchProposalAnchors } from './recheckProposals';
import {
  canKeepProposal,
  canKeepVersion,
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
 * flags what the user should look at. When a change rewrites text that an earlier
 * suggestion wrote, `rewordSuggestion.ts` changes that suggestion and no new one is made.
 * When a change adds an entry or a line to a section that an earlier suggestion made, or a
 * bullet to an entry that one made, `fillSuggestion.ts` puts it into that suggestion.
 *
 * Each suggestion has one or more versions (`proposalVersions.ts`). The page, Preview and
 * Apply use the version the user kept, or the newest when they haven't kept one. Once the
 * user keeps a version, a later change to the suggestion makes a new version instead
 * (`nextVersion.ts` decides which version a change goes into).
 *
 * The user keeps, drops or edits proposals. Their edits are stored in each version's
 * `review`, apart from the assistant's `change`, and `reviewedChange.ts` combines the two.
 * A review edit acts on the version the card shows, which may not be the active one.
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

/** A staged change that edited one version of an earlier suggestion. */
interface ChangedVersion {
  /** The position of that change in the staged list. */
  index: number;
  /** The suggestion as it was before the change. */
  before: Proposal;
  /** The id of the version the change edited. */
  versionId: string;
  /** True when the change made that version, as a copy of the version the user kept. */
  isNewVersion: boolean;
}

/** A suggestion whose text a staged change rewrote. No new suggestion was made. */
export interface RewordedSuggestion extends ChangedVersion {
  /** The suggestion with its new text. When it was removed, the suggestion as it was. */
  proposal: Proposal;
  /** True when the change put back the text the suggestion replaced, which removes it. */
  isRemoved: boolean;
}

/** A staged entry, line or bullet that was added to a suggestion for a new section or entry. */
export interface FilledSuggestion extends ChangedVersion {
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

/** A suggestion whose text a staged change rewrites, and the version the new wording goes into. */
interface SuggestionToReword {
  writer: Proposal;
  edit: TextEdit;
  target: VersionToChange;
}

/**
 * Find the suggestion whose text a change rewrites. Returns null when the change rewrites
 * no text, when the text is the draft's, or when the change must be a suggestion of its
 * own (`findVersionToChange` says when).
 */
function findSuggestionToReword(
  draft: ResumeData,
  proposals: readonly Proposal[],
  change: ProposalChange
): SuggestionToReword | null {
  const edit = readTextEdit(change);
  const writer = edit && findTextWriter(draft, proposals, edit.textId);
  const target = writer && findVersionToChange(writer, edit.textId);
  return target ? { writer, edit, target } : null;
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

/**
 * Return the version a staged change edits: an existing version, or a new copy of the
 * version `target` names.
 */
const readVersionToChange = (target: VersionToChange, rewrittenTextId?: string) =>
  target.kind === 'inPlace' ? target.version : buildNextVersion(target.base, rewrittenTextId);

/** A version that a staged change edited, with the request and reason of that change. */
interface VersionUpdate {
  version: ProposalVersion;
  requestText: string;
  reason?: string;
}

/**
 * Save an edited version into its suggestion. An existing version is replaced, and a new
 * version is added last. Then run its checks again against the copy built from the
 * suggestions before it.
 */
function putChangedVersion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  proposal: Proposal,
  target: VersionToChange,
  { version, requestText, reason }: VersionUpdate
): Proposal {
  const copyBefore = buildCopyBefore(draft, proposals, proposal.id);
  const updated: ProposalVersion = {
    ...version,
    requestText: joinRequestText(version.requestText, requestText),
    // A new version gets the reason for the change that made it.
    reason: target.kind === 'newVersion' ? reason : version.reason,
  };
  const checked = { ...updated, flags: checkReviewedVersion(copyBefore, updated) };
  return target.kind === 'inPlace'
    ? replaceVersion(proposal, checked)
    : addVersion(proposal, checked);
}

/**
 * Put new wording into the suggestion that wrote the text, and run its checks again.
 *
 * When the new wording is the text the suggestion replaced, nothing is left to suggest. A
 * suggestion the user hasn't kept is then removed. For a kept suggestion this returns
 * null, and the change becomes a separate suggestion that puts the old text back.
 */
function rewordSuggestion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  { writer, edit, target }: SuggestionToReword,
  staged: { requestText: string; reason?: string }
): Omit<RewordedSuggestion, 'index'> | null {
  const version = readVersionToChange(target, edit.textId);
  const changed = {
    before: writer,
    versionId: version.id,
    isNewVersion: target.kind === 'newVersion',
  };
  const change = rewordChange(version, edit);
  if (!change) {
    return writer.status === 'pending' ? { ...changed, proposal: writer, isRemoved: true } : null;
  }
  const proposal = putChangedVersion(draft, proposals, writer, target, {
    ...staged,
    version: { ...version, change },
  });
  return { ...changed, proposal, isRemoved: false };
}

/**
 * Add an entry, line or bullet to the suggestion for the new section or entry it goes in,
 * then run that suggestion's checks again. The card labels the addition when a later run
 * made it, or when the user has kept a version, since the kept version doesn't have it.
 */
function fillOpenSuggestion(
  draft: ResumeData,
  proposals: readonly Proposal[],
  suggestion: Proposal,
  change: ProposalChange,
  staged: { requestText: string; reason?: string; isFromEarlierRun: boolean }
): Omit<FilledSuggestion, 'index' | 'filledFlags'> | null {
  const target = findVersionToChange(suggestion);
  if (!target) return null;
  const version = readVersionToChange(target);
  const isLate = staged.isFromEarlierRun || suggestion.status === 'accepted';
  const { filledIds, ...filled } = fillSuggestion(version, change, isLate);
  const proposal = putChangedVersion(draft, proposals, suggestion, target, {
    ...staged,
    version: { ...version, ...filled },
  });
  return {
    before: suggestion,
    versionId: version.id,
    isNewVersion: target.kind === 'newVersion',
    proposal,
    filledIds,
  };
}

/**
 * Stage changes as proposals for the open draft. Each change is checked against the
 * working copy, which includes the changes staged before it in this call. A change that
 * doesn't fit is refused. Two kinds of change update an earlier suggestion instead of
 * making a new one: a rewrite of text that the suggestion wrote, and an entry, line or
 * bullet added to a new section or entry that the suggestion makes. Once the user has kept
 * that suggestion, the change makes a new version of it.
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
  const putProposal = (proposal: Proposal) => {
    proposals = proposals.map((each) => (each.id === proposal.id ? proposal : each));
  };
  changes.forEach(({ change, source, reason }, index) => {
    const copy = buildWorkingCopy(draft, proposals);
    const refusal = validateProposal(copy, change);
    if (refusal) {
      result.refusals.push({ index, refusal });
      return;
    }
    const toFill = findSuggestionToFill(proposals, change);
    const filled =
      toFill &&
      fillOpenSuggestion(draft, proposals, toFill, change, {
        requestText,
        reason,
        isFromEarlierRun: !isMadeNow(toFill.id),
      });
    if (filled) {
      const filledFlags = checkProposal(copy, change, requestText, filled.filledIds);
      result.filled.push({ index, ...filled, filledFlags });
      putProposal(filled.proposal);
      return;
    }
    const toReword = findSuggestionToReword(draft, proposals, change);
    const reworded =
      toReword && rewordSuggestion(draft, proposals, toReword, { requestText, reason });
    if (reworded) {
      result.reworded.push({ index, ...reworded });
      const { id } = reworded.proposal;
      if (reworded.isRemoved) proposals = proposals.filter((each) => each.id !== id);
      else putProposal(reworded.proposal);
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

/**
 * Keep the version of a suggestion that the user chose on its card. If they had kept
 * another version, this one replaces it. Like `acceptProposals`, it also keeps the earlier
 * waiting suggestions this one needs. Returns false when that version can't be kept.
 */
export function keepProposalVersion(id: string, versionId: string): boolean {
  const [proposal] = findOpenProposals([id]);
  const version = proposal?.versions.find((each) => each.id === versionId);
  if (!proposal || !version || !canKeepVersion(proposal, version)) return false;
  const kept = keepVersion(proposal, versionId);
  const proposals = listOpenProposals().map((each) => (each.id === id ? kept : each));
  const requiredIds = findRequiredIds(getResumeSnapshot(), proposals, [id]);
  const required = proposals
    .filter((each) => requiredIds.includes(each.id) && canKeepProposal(each))
    .map((each) => keepVersion(each));
  useProposalStore.getState().replaceProposals(openTemplateId(), [kept, ...required]);
  // The working copy now has this version's text, so later suggestions may go out of date, or come back.
  recheckOpenProposals();
  return true;
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
 * Undo a keep or a drop. Undoing a keep sets the proposal back to waiting. Undoing a drop
 * brings back the version the user had kept, still kept, or else sets it back to waiting.
 * Kept proposals that change their text go back to waiting with them.
 */
export function returnProposals(ids: readonly string[]): void {
  const undone = findOpenProposals(ids).map(undoDecision);
  useProposalStore.getState().replaceProposals(openTemplateId(), undone);
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
 * Some edits in review also keep the version they edit, or set the suggestion back to
 * waiting with nothing kept.
 */
type ReviewDecision = 'keep' | 'returnToWaiting';

const DECIDE: Record<ReviewDecision, (proposal: Proposal, versionId: string) => Proposal> = {
  keep: keepVersion,
  returnToWaiting,
};

/**
 * One edit in review: the fields to save into the version's review, and whether the edit
 * also keeps the version or sets the suggestion back to waiting.
 */
interface ReviewStep {
  patch: ProposalReview;
  decision?: ReviewDecision;
}

/** What a review edit needs to read before it decides what to save. */
interface ReviewContext {
  proposal: Proposal;
  /** The version being edited. */
  version: ProposalVersion;
  /** The resume with the suggestions before this one applied. */
  copyBefore: ResumeData;
}

/**
 * Save one review edit into a version of a suggestion: the version `versionId` names, or the
 * active version without one. `decide` returns the edit, or null when there is nothing to
 * do. The edited version is checked against the copy built from the suggestions before it,
 * and its flags are recomputed for what it now writes. Returns false when nothing was saved
 * or the edited version is refused.
 */
function reviewVersion(
  id: string,
  versionId: string | undefined,
  decide: (context: ReviewContext) => ReviewStep | null
): boolean {
  const [proposal] = findOpenProposals([id]);
  if (!proposal) return false;
  const copyBefore = buildCopyBefore(getResumeSnapshot(), listOpenProposals(), id);
  const version = findVersion(proposal, versionId);
  const step = decide({ proposal, version, copyBefore });
  if (!step) return false;
  const reviewed = { ...version, review: { ...version.review, ...step.patch } };
  const change = resolveChange(reviewed);
  const isStale = findAnchorMismatch(copyBefore, change) !== null;
  if (!isStale && validateProposal(copyBefore, change)) return false;
  const checked = { ...reviewed, flags: checkReviewedVersion(copyBefore, reviewed) };
  const withVersion = replaceVersion(proposal, checked);
  const next = step.decision ? DECIDE[step.decision](withVersion, checked.id) : withVersion;
  // `isStale` is about the active version. Editing another version leaves it as it was.
  const isActive = readActiveVersion(next).id === checked.id;
  useProposalStore
    .getState()
    .replaceProposals(openTemplateId(), [{ ...next, isStale: isActive ? isStale : next.isStale }]);
  recheckOpenProposals();
  if (proposal.status === 'accepted' && next.status === 'pending') returnKeptThatNeedWaiting();
  return true;
}

/**
 * Save the user's own wording for the text a suggestion writes. Editing also keeps the
 * version they edited.
 */
export function editProposal(id: string, text: string, versionId?: string): boolean {
  return reviewVersion(id, versionId, () => ({
    patch: { userText: text.trim() },
    decision: 'keep',
  }));
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

/** Remove the user's wording, so the version writes the assistant's text again. */
export function clearProposalEdit(id: string, versionId?: string): boolean {
  return reviewVersion(id, versionId, () => ({ patch: { userText: undefined } }));
}

/**
 * Save the number the user typed into the gap. Only the user knows this number. Filling
 * it in also keeps the version.
 */
export function fillProposalNumber(id: string, number: string, versionId?: string): boolean {
  const filled = number.trim() || undefined;
  return reviewVersion(id, versionId, () => ({
    patch: { filledNumber: filled, isWithoutNumber: false },
    decision: filled ? 'keep' : undefined,
  }));
}

/** Choose the text that needs no number, or go back to the text with the gap. */
export function chooseTextWithoutNumber(
  id: string,
  isWithout: boolean,
  versionId?: string
): boolean {
  return reviewVersion(id, versionId, () => ({
    patch: { isWithoutNumber: isWithout, filledNumber: undefined },
    decision: isWithout ? 'keep' : undefined,
  }));
}

/**
 * Save the number the user typed into the gap of a new entry's bullet. Unlike a rewrite's
 * number, this doesn't keep the version: the entry's facts may still wait on the user.
 * An empty number takes the gap back to unfilled.
 */
export function fillBulletNumber(
  id: string,
  bulletId: string,
  number: string,
  versionId?: string
): boolean {
  return reviewVersion(id, versionId, ({ version }) => {
    const filledNumbers = { ...version.review.filledNumbers };
    const filled = number.trim();
    if (filled) filledNumbers[bulletId] = filled;
    else delete filledNumbers[bulletId];
    return { patch: { filledNumbers } };
  });
}

/**
 * Choose the text of a new entry's bullet that needs no number, or go back to the text
 * with the gap. Either way, a number typed into the gap is cleared.
 */
export function chooseBulletWithoutNumber(
  id: string,
  bulletId: string,
  isWithout: boolean,
  versionId?: string
): boolean {
  return reviewVersion(id, versionId, ({ version: { review } }) => {
    const others = (review.withoutNumberIds ?? []).filter((each) => each !== bulletId);
    const filledNumbers = { ...review.filledNumbers };
    delete filledNumbers[bulletId];
    return {
      patch: { withoutNumberIds: isWithout ? [...others, bulletId] : others, filledNumbers },
    };
  });
}

/** Return the facts confirmed for one new entry, with `fact` added or taken out. */
function setFactConfirmed(
  { review }: ProposalVersion,
  { entryId, fact }: EntryFactPlace,
  isConfirmed: boolean
): ProposalReview['confirmedFacts'] {
  const confirmedFacts = review.confirmedFacts ?? {};
  const others = (confirmedFacts[entryId] ?? []).filter((each) => each !== fact);
  return { ...confirmedFacts, [entryId]: isConfirmed ? [...others, fact] : others };
}

/**
 * Confirm one fact of a new entry, or undo the confirmation. Undoing it in the kept version
 * sets the suggestion back to waiting.
 */
export function confirmProposalFact(
  id: string,
  place: EntryFactPlace,
  isConfirmed: boolean,
  versionId?: string
): boolean {
  return reviewVersion(id, versionId, ({ proposal, version }) => {
    const isKept = proposal.status === 'accepted' && proposal.keptVersionId === version.id;
    return {
      patch: { confirmedFacts: setFactConfirmed(version, place, isConfirmed) },
      decision: !isConfirmed && isKept ? 'returnToWaiting' : undefined,
    };
  });
}

/** Save one fact of a new entry in the user's words. This also confirms the fact. */
export function editProposalFact(
  id: string,
  place: EntryFactPlace,
  text: string,
  versionId?: string
): boolean {
  return reviewVersion(id, versionId, ({ version }) => {
    const { factEdits = {} } = version.review;
    const entryEdits = { ...factEdits[place.entryId], [place.fact]: text.trim() };
    return {
      patch: {
        confirmedFacts: setFactConfirmed(version, place, true),
        factEdits: { ...factEdits, [place.entryId]: entryEdits },
      },
    };
  });
}

/**
 * Leave one entry out of a suggested new section, keeping the other entries. Throws when
 * it is the last remaining entry, because the card never offers that: to leave out the
 * whole section, the user drops the suggestion.
 */
export function leaveEntryOut(id: string, entryId: string, versionId?: string): boolean {
  return reviewVersion(id, versionId, ({ version }) => {
    const entriesNotLeftOut = listNewEntries(version).filter((entry) => !entry.isLeftOut);
    const isAlreadyLeftOut = !entriesNotLeftOut.some((entry) => entry.ids.entryId === entryId);
    if (isAlreadyLeftOut) return null;
    if (entriesNotLeftOut.length === 1) {
      throw new Error(
        `Cannot leave out entry "${entryId}" of suggestion "${id}": it is the only entry not left out`
      );
    }
    return { patch: { leftOutEntryIds: [...(version.review.leftOutEntryIds ?? []), entryId] } };
  });
}

/** Put a left-out entry back into its new section. */
export function putEntryBack(id: string, entryId: string, versionId?: string): boolean {
  return reviewVersion(id, versionId, ({ version }) => {
    const leftOutEntryIds = (version.review.leftOutEntryIds ?? []).filter(
      (each) => each !== entryId
    );
    return { patch: { leftOutEntryIds } };
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

/*
 * The actions below handle a suggestion that is out of date. Out of date applies to the
 * whole suggestion, not one version, so they act on its active version.
 */

/**
 * Move added text to the end of its entry or section. Used when the bullet or line it
 * was placed after no longer exists. The suggestion goes back to waiting.
 */
export function placeProposalLast(id: string): boolean {
  return reviewVersion(id, undefined, ({ version: { change }, copyBefore }) => {
    if (change.kind !== 'add') return null;
    const among = readAddedAmong(copyBefore, change.place);
    if (!among) return null;
    return { patch: { placedAfterId: among.at(-1) ?? null }, decision: 'returnToWaiting' };
  });
}

/** Undo `placeProposalLast`. Its original place is gone, so it is out of date again. */
export function cancelPlacedLast(id: string): boolean {
  return reviewVersion(id, undefined, () => ({
    patch: { placedAfterId: undefined },
    decision: 'returnToWaiting',
  }));
}

/** Save the user's wording for a new section's heading. A heading is not a fact, so it needs no confirming. */
export function renameProposedSection(id: string, label: string, versionId?: string): boolean {
  const sectionLabel = label.trim();
  if (!sectionLabel) return false;
  return reviewVersion(id, versionId, () => ({ patch: { sectionLabel } }));
}

/**
 * Let the user review an out-of-date rewrite, merge or rename against the text as it is
 * now. The suggestion goes back to waiting. Keeping it replaces the user's edit.
 */
export function reviewStaleProposalAnyway(id: string): boolean {
  return reviewVersion(id, undefined, ({ version, copyBefore }) => {
    const rebasedBefore = readRebasedBefore(version.change, copyBefore);
    if (!rebasedBefore) return null;
    return { patch: { rebasedBefore, userText: undefined }, decision: 'returnToWaiting' };
  });
}

/** Undo `reviewStaleProposalAnyway`. The suggestion is out of date again. */
export function cancelStaleReview(id: string): boolean {
  return reviewVersion(id, undefined, () => ({
    patch: { rebasedBefore: undefined, userText: undefined },
    decision: 'returnToWaiting',
  }));
}

/** Save why the user dropped these proposals. The reasons are for the assistant's next run. */
export function setDropReasons(ids: readonly string[], reasons: DropReason[], note?: string): void {
  const dropReasons = { reasons, note: note?.trim() || undefined };
  useProposalStore.getState().replaceProposals(
    openTemplateId(),
    findOpenProposals(ids).map((proposal) => ({ ...proposal, dropReasons }))
  );
}
