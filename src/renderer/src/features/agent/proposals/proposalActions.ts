import type {
  DropReason,
  EntryFact,
  Proposal,
  ProposalChange,
  ProposalReview,
  ProposalSource,
  ProposalStatus,
} from '@shared/types/agentProposal';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { checkProposal } from './checkProposal';
import { findEntry, isProposalCurrent } from './proposalAnchor';
import { watchProposalAnchors } from './recheckProposals';
import { canKeepProposal, resolveChange, reviewedRequestText } from './reviewedChange';
import { validateProposal, type ProposalRefusal } from './validateProposal';

/*
 * Proposals: the assistant's suggested changes to the open draft, waiting for the user.
 *
 * A run stages changes here: `validateProposal` refuses what doesn't fit the draft, and
 * `checkProposal` flags what deserves a look. The user keeps, drops or edits them, and
 * what they do is kept apart from the assistant's change (`reviewedChange.ts` puts the two
 * together); `recheckProposals` marks any the draft has moved past as stale, and back.
 * `planApply` says what applying would do, and `applyAcceptedProposals` does it as one
 * undo step, with a version either side.
 *
 * Other modules use this file, `planApply.ts`, `applyAcceptedProposals.ts`,
 * `reviewedChange.ts`, `describeSuggestion.ts`, and `diffWords.ts` for marks. State is
 * `stores/proposalStore.ts`, which only these files write.
 */

export interface StagedChange {
  change: ProposalChange;
  source: ProposalSource;
  reason?: string;
}

export interface StagingResult {
  proposals: Proposal[];
  /** By the change's place in what was staged, so a run can say which to fix. */
  refusals: { index: number; refusal: ProposalRefusal }[];
}

function openTemplateId(): string {
  const id = useResumeStore.getState().templateId;
  if (id === null) throw new Error('No template is open');
  return id;
}

/** Proposals for the open draft. Each is checked against it; the ones that don't fit are refused. */
export function stageProposals(requestText: string, changes: StagedChange[]): StagingResult {
  const templateId = openTemplateId();
  const doc = getResumeSnapshot();
  const result: StagingResult = { proposals: [], refusals: [] };
  changes.forEach(({ change, source, reason }, index) => {
    const refusal = validateProposal(doc, change);
    if (refusal) {
      result.refusals.push({ index, refusal });
      return;
    }
    result.proposals.push({
      id: crypto.randomUUID(),
      templateId,
      source,
      change,
      status: 'pending',
      review: {},
      isStale: false,
      flags: checkProposal(change, requestText),
      reason,
      requestText,
      createdAt: Date.now(),
    });
  });
  if (result.proposals.length) {
    watchProposalAnchors();
    useProposalStore.getState().addProposals(templateId, result.proposals);
  }
  return result;
}

const findOpenProposals = (ids: readonly string[]) =>
  (useProposalStore.getState().byTemplate[openTemplateId()] ?? []).filter((proposal) =>
    ids.includes(proposal.id)
  );

/** Kept, the ones that can be: current, with every fact of a new entry confirmed. */
export function acceptProposals(ids: readonly string[]): void {
  const keepable = findOpenProposals(ids).filter(canKeepProposal);
  useProposalStore.getState().setStatus(
    openTemplateId(),
    keepable.map((proposal) => proposal.id),
    'accepted'
  );
}

export function rejectProposals(ids: readonly string[]): void {
  useProposalStore.getState().setStatus(openTemplateId(), ids, 'rejected');
}

/** Back to waiting: a keep or a drop taken back. */
export function returnProposals(ids: readonly string[]): void {
  useProposalStore.getState().setStatus(openTemplateId(), ids, 'pending');
}

/** Gone from review, as if never suggested. All of the open draft's, or only these. */
export function discardProposals(ids?: readonly string[]): void {
  useProposalStore.getState().removeProposals(openTemplateId(), ids);
}

/**
 * One proposal changed by `update`, then checked again against the draft: a change that no
 * longer fits is refused (false), and its flags follow what it now writes.
 */
function reviewProposal(id: string, update: (proposal: Proposal) => Proposal | null): boolean {
  const [proposal] = findOpenProposals([id]);
  const next = proposal && update(proposal);
  if (!next) return false;
  const doc = getResumeSnapshot();
  const change = resolveChange(next);
  const isStale = !isProposalCurrent(doc, change);
  if (!isStale && validateProposal(doc, change)) return false;
  const flags = checkProposal(change, reviewedRequestText(next));
  useProposalStore.getState().replaceProposals(openTemplateId(), [{ ...next, isStale, flags }]);
  return true;
}

const withReview =
  (patch: ProposalReview, status?: ProposalStatus) =>
  (proposal: Proposal): Proposal => ({
    ...proposal,
    review: { ...proposal.review, ...patch },
    status: status ?? proposal.status,
  });

/** The user's own wording for a rewrite or merge. Editing is saying yes to it. */
export function editProposal(id: string, text: string): boolean {
  return reviewProposal(id, withReview({ userText: text.trim() }, 'accepted'));
}

/** Back to the assistant's wording. */
export function clearProposalEdit(id: string): boolean {
  return reviewProposal(id, withReview({ userText: undefined }));
}

/** The number only the user knows, typed into the gap. Filling it in keeps the suggestion. */
export function fillProposalNumber(id: string, number: string): boolean {
  const filled = number.trim() || undefined;
  return reviewProposal(
    id,
    withReview({ filledNumber: filled, isWithoutNumber: false }, filled ? 'accepted' : undefined)
  );
}

/** The version that needs no number, or back to the one with the gap. */
export function chooseVersionWithoutNumber(id: string, isWithout: boolean): boolean {
  return reviewProposal(
    id,
    withReview(
      { isWithoutNumber: isWithout, filledNumber: undefined },
      isWithout ? 'accepted' : undefined
    )
  );
}

/** One of a new entry's facts vouched for, or taken back, which unkeeps the entry. */
export function confirmProposalFact(id: string, fact: EntryFact, isConfirmed: boolean): boolean {
  return reviewProposal(id, (proposal) => {
    const others = (proposal.review.confirmedFacts ?? []).filter((each) => each !== fact);
    const confirmedFacts = isConfirmed ? [...others, fact] : others;
    const status = !isConfirmed && proposal.status === 'accepted' ? 'pending' : undefined;
    return withReview({ confirmedFacts }, status)(proposal);
  });
}

/** One of a new entry's facts in the user's words, which confirms it. */
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

/** What a rewrite or merge would replace now: its bullets' text in the draft. */
function readRebasedBefore(change: ProposalChange): ProposalReview['rebasedBefore'] | null {
  if (change.kind !== 'rewrite' && change.kind !== 'merge') return null;
  const bullets = findEntry(getResumeSnapshot(), change.sectionId, change.entryId)?.bullets;
  const textOf = (bulletId: string) => bullets?.find((bullet) => bullet.id === bulletId)?.text;
  if (change.kind === 'rewrite') return textOf(change.bulletId) ?? null;
  const [first, second] = [textOf(change.firstId), textOf(change.secondId)];
  return first !== undefined && second !== undefined ? [first, second] : null;
}

/**
 * An out-of-date rewrite or merge, reviewed against the bullet as the user left it: it
 * waits again, and keeping it replaces their edit.
 */
export function reviewStaleProposalAnyway(id: string): boolean {
  return reviewProposal(id, (proposal) => {
    const rebasedBefore = readRebasedBefore(proposal.change);
    if (!rebasedBefore) return null;
    return withReview({ rebasedBefore, userText: undefined }, 'pending')(proposal);
  });
}

/** Back to out of date, against the text it was suggested for. */
export function cancelStaleReview(id: string): boolean {
  return reviewProposal(
    id,
    withReview({ rebasedBefore: undefined, userText: undefined }, 'pending')
  );
}

/** Why these were dropped, for the assistant's next turn. */
export function setDropReasons(ids: readonly string[], reasons: DropReason[], note?: string): void {
  const dropReasons = { reasons, note: note?.trim() || undefined };
  useProposalStore.getState().replaceProposals(
    openTemplateId(),
    findOpenProposals(ids).map((proposal) => withReview({ dropReasons })(proposal))
  );
}
