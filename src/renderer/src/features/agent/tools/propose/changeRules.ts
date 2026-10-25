import { checkProposal } from '@/features/suggestions/proposals/checks/checkProposal';
import { readShowPlaceId, readTextPlaceId } from '@/features/suggestions/proposals/proposalAnchor';
import { validateProposal } from '@/features/suggestions/proposals/validateProposal';
import type { OrderPlace, ProposalChange, ProposalFlagKind } from '@shared/types/agentProposal';
import type { ToolCallContext } from '../agentToolRun';
import { describeFlag, describeNoChange, describeTarget } from './describeForModel';
import { diagnose, type Diagnostic } from './toolDiagnostics';

/*
 * What every change goes through before it is staged, whichever tool made it, in order:
 * the first rule that has something to say decides, and a change none of them stops is
 * staged. Nothing here writes a store; only a definite mistake marks the run, so it is
 * sent back once per target.
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

/** The run's own suggestion for this target, waiting with the very same change. */
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

/** A definite mistake, the first time this target makes one. */
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

/** Each rule, and the kind of line it says: a change that is already so isn't an error. */
const RULES: { rule: ChangeRule; kind: 'info' | 'error' }[] = [
  { rule: findsNoChange, kind: 'info' },
  { rule: repeatsWaiting, kind: 'info' },
  { rule: failsValidation, kind: 'error' },
  { rule: makesDefiniteMistake, kind: 'error' },
];

/** What stops a change from being staged, or null to stage it. */
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
