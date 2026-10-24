import { checkProposal } from '@/features/suggestions/proposals/checks/checkProposal';
import { readShowPlaceId, readTextPlaceId } from '@/features/suggestions/proposals/proposalAnchor';
import {
  discardProposals,
  stageProposals,
  type StagedChange,
} from '@/features/suggestions/proposals/proposalActions';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import type {
  OrderPlace,
  Proposal,
  ProposalChange,
  ProposalFlagKind,
} from '@shared/types/agentProposal';
import { answer, refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { describeFlag, describeResultWeWrote, describeTarget } from './describeForModel';

/*
 * A propose tool's last step, where our code checks the model's work before the user sees
 * it. A definite mistake goes back to the model to fix, once per target; what passes is
 * staged through `proposals/`, replacing this run's earlier suggestion of the same kind for
 * the same target; and the model hears what the checks noticed about each.
 */

/** Never what the user meant: sent back to fix before anything is staged. */
const DEFINITE_MISTAKES: ReadonlySet<ProposalFlagKind> = new Set(['doubledWords']);

/** The list a reorder is of, as a key: "sections", or the section's or entry's id. */
function readOrderKey(place: OrderPlace): string {
  if (place.unit === 'sections') return 'sections';
  return place.unit === 'bullets' ? place.entryId : place.sectionId;
}

/**
 * What a change is a suggestion for, so a second one of its kind replaces the first. Added
 * text and new entries and sections have none: two of them are two suggestions.
 */
function targetKeyOf(change: ProposalChange): string | null {
  switch (change.kind) {
    case 'rewrite':
      return `rewrite:${readTextPlaceId(change.place)}`;
    case 'select':
      return `select:${readShowPlaceId(change.place)}`;
    case 'split':
      return `split:${change.bulletId}`;
    case 'merge':
      return `merge:${change.firstId}`;
    case 'reorder':
      return `reorder:${readOrderKey(change.place)}`;
    case 'rename':
      return `rename:${change.sectionId}`;
    case 'add':
    case 'entry':
    case 'section':
      return null;
  }
}

/** The fix for a definite mistake, the first time this target makes one; null otherwise. */
function sendBackForRepair(run: AgentToolRun, change: ProposalChange): string | null {
  const key = targetKeyOf(change);
  if (!key || run.repairedTargets.has(key)) return null;
  const mistakes = checkProposal(getResumeSnapshot(), change, run.requestText).filter((flag) =>
    DEFINITE_MISTAKES.has(flag.kind)
  );
  if (!mistakes.length) return null;
  run.repairedTargets.add(key);
  const fixes = mistakes.map(describeFlag).join(' ');
  return `Not suggested for ${describeTarget(run, change)}: ${fixes} Propose it again.`;
}

const isWaiting = (proposalId: string) =>
  Object.values(useProposalStore.getState().byTemplate).some((proposals) =>
    proposals.some((proposal) => proposal.id === proposalId && proposal.status === 'pending')
  );

/**
 * The new suggestions take the place of this run's earlier ones for the same targets, if
 * the user hasn't acted on those yet.
 */
function replaceEarlierSuggestions(run: AgentToolRun, staged: Proposal[]) {
  const replacedIds: string[] = [];
  for (const proposal of staged) {
    const key = targetKeyOf(proposal.change);
    if (!key) continue;
    const earlierId = run.suggestionIdByTarget.get(key);
    if (earlierId && isWaiting(earlierId)) replacedIds.push(earlierId);
    run.suggestionIdByTarget.set(key, proposal.id);
  }
  if (replacedIds.length) discardProposals(replacedIds);
}

function describeStaged(run: AgentToolRun, proposal: Proposal): string {
  const checks = proposal.flags.map(describeFlag);
  const suggested = [
    `Suggested for ${describeTarget(run, proposal.change)}.`,
    describeResultWeWrote(proposal),
  ];
  return [
    suggested.filter(Boolean).join(' '),
    `Checks: ${checks.length ? checks.join(' ') : 'none.'}`,
  ].join('\n');
}

export function stageSuggestions(run: AgentToolRun, changes: StagedChange[]): ToolAnswer {
  const sentBack: string[] = [];
  const passed: StagedChange[] = [];
  for (const staged of changes) {
    const fix = sendBackForRepair(run, staged.change);
    if (fix) sentBack.push(fix);
    else passed.push(staged);
  }

  const { proposals, refusals } = stageProposals(run.requestText, passed);
  replaceEarlierSuggestions(run, proposals);

  const refused = refusals.map(
    ({ index, refusal }) =>
      `Not suggested for ${describeTarget(run, passed[index].change)}: ${refusal.fix}`
  );
  const content = [
    ...proposals.map((proposal) => describeStaged(run, proposal)),
    ...sentBack,
    ...refused,
  ].join('\n\n');
  return proposals.length ? answer(content) : refuse(content);
}
