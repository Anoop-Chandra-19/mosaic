import {
  stageProposals,
  type RewordedSuggestion,
  type StagedChange,
  type StagingResult,
} from '@/features/suggestions/proposals/proposalActions';
import { replayProposals } from '@/features/suggestions/proposals/workingCopy';
import type { Proposal } from '@/types/agentProposal';
import type { AgentToolRun, ToolAnswer, ToolCallContext } from '../tool-run/agentToolRun';
import type { CompiledCall } from './compileProposeCall';
import { describeFlag, describeResultWeWrote, describeTarget } from './describeForModel';
import { diagnose, formatToolAnswer, type Diagnostic } from './toolDiagnostics';

/*
 * Finish a compiled propose call by staging accepted changes through
 * `suggestions/proposals/`. Then apply the staged changes to the run's receipt, and
 * report each result and its check findings to the model.
 *
 * A rewrite of text that a waiting suggestion wrote changes that suggestion. The model
 * gets the same answer as for a new suggestion, with the changed suggestion's checks.
 */

const NOTHING_STAGED: StagingResult = { proposals: [], reworded: [], refusals: [] };

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
 * Record which suggestions the run made or changed. The run card counts them. A changed
 * suggestion from before the run is also stored as it was, for discarding the run.
 */
function recordStagedIds(run: AgentToolRun, { proposals, reworded }: StagingResult) {
  for (const proposal of proposals) run.stagedIds.add(proposal.id);
  for (const { before, proposal, isRemoved } of reworded) {
    const isFromBeforeRun = !run.stagedIds.has(before.id);
    if (isFromBeforeRun) run.suggestionsBeforeRun.set(before.id, before);
    if (isRemoved) run.stagedIds.delete(proposal.id);
    else run.stagedIds.add(proposal.id);
  }
}

/**
 * Apply the changes the model just made to the run's receipt. The model knows what it
 * changed, so it can edit that text again without calling read_document.
 */
function applyToReceipt(run: AgentToolRun, made: Proposal[]) {
  if (!run.receipt || !made.length) return;
  run.receipt = { ...run.receipt, doc: replayProposals(run.receipt.doc, made).doc };
}

/** Describe a staged change and its checks, including any code-generated result text. */
function describeStaged(run: AgentToolRun, proposal: Proposal): Diagnostic {
  const checks = proposal.flags.map(describeFlag);
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
  const staging = compiled.toStage.length
    ? stageProposals(run.requestText, compiled.toStage)
    : NOTHING_STAGED;
  const rewrites = staging.reworded.map((reworded) => ({
    isRemoved: reworded.isRemoved,
    rewrite: readRewriteAsAsked(reworded, compiled.toStage[reworded.index]),
  }));
  recordStagedIds(run, staging);
  applyToReceipt(run, [...staging.proposals, ...rewrites.map(({ rewrite }) => rewrite)]);
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
    ...refused,
  ]);
}
