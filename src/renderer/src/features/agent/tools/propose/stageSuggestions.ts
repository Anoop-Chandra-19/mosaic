import { discardProposals, stageProposals } from '@/features/suggestions/proposals/proposalActions';
import type { Proposal } from '@/types/agentProposal';
import type { AgentToolRun, ToolAnswer, ToolCallContext } from '../tool-run/agentToolRun';
import { targetKeyOf } from './changeRules';
import type { CompiledCall } from './compileProposeCall';
import { describeFlag, describeResultWeWrote, describeTarget } from './describeForModel';
import { diagnose, formatToolAnswer, type Diagnostic } from './toolDiagnostics';

/*
 * A compiled propose call's last step: what the rules left is staged through
 * `proposals/`, replacing this run's earlier suggestion for the same target if the user
 * hasn't acted on it, and the model hears a line for each, with what the checks noticed.
 */

/** The new suggestions take the place of this run's earlier ones for the same targets. */
function replaceEarlierSuggestions({ run, waiting }: ToolCallContext, staged: Proposal[]) {
  const replacedIds: string[] = [];
  for (const proposal of staged) {
    run.stagedIds.add(proposal.id);
    const key = targetKeyOf(proposal.change);
    if (!key) continue;
    const earlierId = run.suggestionIdByTarget.get(key);
    if (waiting.some((each) => each.id === earlierId)) replacedIds.push(earlierId!);
    run.suggestionIdByTarget.set(key, proposal.id);
  }
  for (const id of replacedIds) run.stagedIds.delete(id);
  if (replacedIds.length) discardProposals(replacedIds);
}

/** "b3: suggested. Checks: none.", with the result where our code wrote it. */
function describeStaged(run: AgentToolRun, proposal: Proposal): Diagnostic {
  const checks = proposal.flags.map(describeFlag);
  const text = [
    'suggested.',
    describeResultWeWrote(proposal),
    `Checks: ${checks.length ? checks.join(' ') : 'none.'}`,
  ];
  return diagnose('ok', describeTarget(run, proposal.change), text.filter(Boolean).join(' '));
}

export function stageCompiledCall(context: ToolCallContext, compiled: CompiledCall): ToolAnswer {
  const { run } = context;
  const { proposals, refusals } = compiled.toStage.length
    ? stageProposals(run.requestText, compiled.toStage)
    : { proposals: [], refusals: [] };
  replaceEarlierSuggestions(context, proposals);
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
