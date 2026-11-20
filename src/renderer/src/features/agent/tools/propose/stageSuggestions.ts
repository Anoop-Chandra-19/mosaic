import {
  stageProposals,
  type FilledSuggestion,
  type RewordedSuggestion,
  type StagedChange,
  type StagingResult,
} from '@/features/suggestions/proposals/proposalActions';
import { replayProposals } from '@/features/suggestions/proposals/workingCopy';
import type { Proposal } from '@/types/agentProposal';
import type { AgentToolRun, ToolAnswer, ToolCallContext } from '../tool-run/agentToolRun';
import { handleFor } from '../tool-run/resumeHandles';
import type { CompiledCall } from './compileProposeCall';
import { describeFlag, describeResultWeWrote, describeTarget } from './describeForModel';
import { diagnose, formatToolAnswer, type Diagnostic } from './toolDiagnostics';

/*
 * Finish a compiled propose call by staging accepted changes through
 * `suggestions/proposals/`. Then apply the staged changes to the run's receipt, and
 * report each result and its check findings to the model.
 *
 * A rewrite of text that a waiting suggestion wrote changes that suggestion. The model
 * gets the same answer as for a new suggestion, with the changed suggestion's checks. An
 * entry, line or bullet for a section or entry that a waiting suggestion made goes into
 * that suggestion, and is answered the same way.
 */

const NOTHING_STAGED: StagingResult = { proposals: [], reworded: [], filled: [], refusals: [] };

/**
 * Return the rewrite the model asked for, with the checks of the suggestion it changed.
 * The receipt and the answer need the rewrite as the model made it. The changed
 * suggestion can't be used for that, because it starts from the user's text and the
 * receipt holds the text the model last wrote.
 */
const readRewriteAsAsked = ({ proposal }: RewordedSuggestion, asked: StagedChange): Proposal => ({
  ...proposal,
  change: asked.change,
  source: asked.source,
  newContentIds: null,
  review: {},
});

/**
 * Return the entry, line or bullet the model asked for, which went into a waiting
 * suggestion. The receipt and the answer need it as the model made it, with its own ids
 * and its own checks.
 */
const readFillingAsAsked = (filled: FilledSuggestion, asked: StagedChange): Proposal => ({
  ...filled.proposal,
  change: asked.change,
  source: asked.source,
  newContentIds: filled.filledIds,
  flags: filled.filledFlags,
  review: {},
});

/**
 * Record which suggestions the run made or changed. The run card counts them. A changed
 * suggestion from before the run is also stored as it was, for discarding the run.
 */
function recordStagedIds(run: AgentToolRun, { proposals, reworded, filled }: StagingResult) {
  for (const proposal of proposals) run.stagedIds.add(proposal.id);
  for (const { before, proposal, ...changed } of [...reworded, ...filled]) {
    const isFromBeforeRun = !run.stagedIds.has(before.id);
    if (isFromBeforeRun) run.suggestionsBeforeRun.set(before.id, before);
    const isRemoved = 'isRemoved' in changed && changed.isRemoved;
    if (isRemoved) run.stagedIds.delete(proposal.id);
    else run.stagedIds.add(proposal.id);
  }
}

/**
 * Apply the changes the model just made to the run's receipt. The model knows what it
 * changed, so it can edit that text again without calling read_document.
 */
function applyToReceipt(run: AgentToolRun, made: Proposal[], filled: FilledSuggestion[]) {
  if (!run.receipt || !made.length) return;
  const { doc } = replayProposals(run.receipt.doc, made);
  // A custom section's first entry makes it an entries section. Only its suggestion says so.
  for (const { proposal } of filled) {
    const { change, newContentIds } = proposal;
    if (change.kind !== 'section' || newContentIds?.kind !== 'section') continue;
    const section = doc.sections.find((each) => each.id === newContentIds.sectionId);
    if (section) section.layout = change.section.layout;
  }
  run.receipt = { ...run.receipt, doc };
}

/** Describe a staged change and its checks, including any code-generated result text. */
function describeStaged(run: AgentToolRun, proposal: Proposal): Diagnostic {
  // A flag on one bullet of a new entry names that bullet, so the model can fix only that bullet.
  const checks = proposal.flags.map((flag) =>
    flag.textId
      ? `In ${handleFor(run.handles, 'bullet', flag.textId)}: ${describeFlag(flag)}`
      : describeFlag(flag)
  );
  const text = [
    'suggested.',
    describeResultWeWrote(run, proposal),
    `Checks: ${checks.length ? checks.join(' ') : 'none.'}`,
  ];
  return diagnose('ok', describeTarget(run, proposal.change), text.filter(Boolean).join(' '));
}

const describeRemoved = (run: AgentToolRun, rewrite: Proposal): Diagnostic =>
  diagnose(
    'ok',
    describeTarget(run, rewrite.change),
    'it reads as the user wrote it again, so nothing is suggested for it now.'
  );

export function stageCompiledCall(context: ToolCallContext, compiled: CompiledCall): ToolAnswer {
  const { run } = context;
  // This run made a suggestion if it staged it and the suggestion didn't exist before the run.
  const isFromThisRun = (id: string) => run.stagedIds.has(id) && !run.suggestionsBeforeRun.has(id);
  const staging = compiled.toStage.length
    ? stageProposals(run.requestText, compiled.toStage, isFromThisRun)
    : NOTHING_STAGED;
  const rewrites = staging.reworded.map((reworded) => ({
    isRemoved: reworded.isRemoved,
    rewrite: readRewriteAsAsked(reworded, compiled.toStage[reworded.index]),
  }));
  const fillings = staging.filled.map((filled) =>
    readFillingAsAsked(filled, compiled.toStage[filled.index])
  );
  recordStagedIds(run, staging);
  applyToReceipt(
    run,
    [...staging.proposals, ...rewrites.map(({ rewrite }) => rewrite), ...fillings],
    staging.filled
  );
  const refused = staging.refusals.map(({ index, refusal }) =>
    diagnose(
      'error',
      describeTarget(run, compiled.toStage[index].change),
      `not suggested. ${refusal.fix}`
    )
  );
  return formatToolAnswer([
    ...compiled.diagnostics,
    ...staging.proposals.map((proposal) => describeStaged(run, proposal)),
    ...rewrites.map(({ rewrite, isRemoved }) =>
      isRemoved ? describeRemoved(run, rewrite) : describeStaged(run, rewrite)
    ),
    ...fillings.map((filling) => describeStaged(run, filling)),
    ...refused,
  ]);
}
