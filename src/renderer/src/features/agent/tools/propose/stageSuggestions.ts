import { stageProposals } from '@/features/suggestions/proposals/proposalActions';
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
 */

/**
 * Apply the newly staged suggestions to the run's receipt. The model knows what it just
 * changed, so it can edit that text again without calling read_document.
 */
function applyToReceipt(run: AgentToolRun, staged: Proposal[]) {
  for (const proposal of staged) run.stagedIds.add(proposal.id);
  if (!run.receipt || !staged.length) return;
  run.receipt = { ...run.receipt, doc: replayProposals(run.receipt.doc, staged).doc };
}

/** Describe a staged suggestion and its checks, including any code-generated result text. */
function describeStaged(run: AgentToolRun, proposal: Proposal): Diagnostic {
  const checks = proposal.flags.map(describeFlag);
  const text = [
    'suggested.',
    describeResultWeWrote(run, proposal),
    `Checks: ${checks.length ? checks.join(' ') : 'none.'}`,
  ];
  return diagnose('ok', describeTarget(run, proposal.change), text.filter(Boolean).join(' '));
}

export function stageCompiledCall(context: ToolCallContext, compiled: CompiledCall): ToolAnswer {
  const { run } = context;
  const { proposals, refusals } = compiled.toStage.length
    ? stageProposals(run.requestText, compiled.toStage)
    : { proposals: [], refusals: [] };
  applyToReceipt(run, proposals);
  const refused = refusals.map(({ index, refusal }) =>
    diagnose(
      'error',
      describeTarget(run, compiled.toStage[index].change),
      `not suggested. ${refusal.fix}`
    )
  );
  return formatToolAnswer([
    ...compiled.diagnostics,
    ...proposals.map((proposal) => describeStaged(run, proposal)),
    ...refused,
  ]);
}
