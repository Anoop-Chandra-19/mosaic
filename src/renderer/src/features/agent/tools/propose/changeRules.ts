import { checkProposal } from '@/features/suggestions/proposals/checks/checkProposal';
import { validateProposal } from '@/features/suggestions/proposals/validateProposal';
import { readShowPlaceId, readTextPlaceId } from '@/lib/resume/proposalAnchor';
import type { OrderPlace, ProposalChange, ProposalFlagKind } from '@/types/agentProposal';
import type { ToolCallContext } from '../tool-run/agentToolRun';
import { describeFlag, describeNoChange, describeTarget } from './describeForModel';
import { diagnose, type Diagnostic } from './toolDiagnostics';

/*
 * Apply the same ordered rules to every proposed change before staging. The first
 * matching rule returns a diagnostic; changes that pass all rules can be staged.
 * This module never writes to stores. Only definite mistakes update run state,
 * so each target is sent back for repair at most once.
 */

/** Mistake kinds that require a repair attempt before staging a target's change. */
const DEFINITE_MISTAKES: ReadonlySet<ProposalFlagKind> = new Set(['doubledWords']);

/** Identify the reordered list by "sections", its section ID, or its entry ID. */
function readOrderKey(place: OrderPlace): string {
  if (place.unit === 'sections') return 'sections';
  return place.unit === 'bullets' ? place.entryId : place.sectionId;
}

/**
 * Identify a change's kind and target so a later suggestion can replace an earlier one.
 * Added text, entries, and sections have no key: each addition is a separate suggestion.
 */
export function targetKeyOf(change: ProposalChange): string | null {
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

type ChangeRule = (context: ToolCallContext, change: ProposalChange) => string | null;

const findsNoChange: ChangeRule = (context, change) => {
  const fact = describeNoChange(context.doc, change);
  return fact && `nothing changed. ${fact}`;
};

/** Detect an identical pending suggestion from this run for the same target. */
const repeatsWaiting: ChangeRule = ({ run, waiting }, change) => {
  const key = targetKeyOf(change);
  const earlierId = key ? run.suggestionIdByTarget.get(key) : undefined;
  const earlier = waiting.find((proposal) => proposal.id === earlierId);
  const isRepeat = earlier && JSON.stringify(earlier.change) === JSON.stringify(change);
  return isRepeat ? 'already suggested, waiting for the user.' : null;
};

const failsValidation: ChangeRule = ({ doc }, change) => {
  const refusal = validateProposal(doc, change);
  return refusal && `not suggested. ${refusal.fix}`;
};

/** Request repair once per target when a change contains a definite mistake. */
const makesDefiniteMistake: ChangeRule = ({ run, doc }, change) => {
  const key = targetKeyOf(change);
  if (!key || run.repairedTargets.has(key)) return null;
  const mistakes = checkProposal(doc, change, run.requestText).filter((flag) =>
    DEFINITE_MISTAKES.has(flag.kind)
  );
  if (!mistakes.length) return null;
  run.repairedTargets.add(key);
  return `not suggested. ${mistakes.map(describeFlag).join(' ')} Propose it again.`;
};

/** Rules and diagnostic kinds; no-op changes and pending duplicates are informational. */
const RULES: { rule: ChangeRule; kind: 'info' | 'error' }[] = [
  { rule: findsNoChange, kind: 'info' },
  { rule: repeatsWaiting, kind: 'info' },
  { rule: failsValidation, kind: 'error' },
  { rule: makesDefiniteMistake, kind: 'error' },
];

/** Return the first diagnostic that stops staging, or null if all rules pass. */
export function applyChangeRules(
  context: ToolCallContext,
  change: ProposalChange
): Diagnostic | null {
  for (const { rule, kind } of RULES) {
    const text = rule(context, change);
    if (text) return diagnose(kind, describeTarget(context.run, change), text);
  }
  return null;
}
