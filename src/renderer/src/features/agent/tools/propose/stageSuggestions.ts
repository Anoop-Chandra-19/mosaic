import {
  stageProposals,
  type FilledSuggestion,
  type RewordedSuggestion,
  type StagedChange,
  type StagingResult,
} from '@/features/suggestions/proposals/proposalActions';
import { applyProposalsToResume } from '@/features/suggestions/proposals/apply/applyProposalsToResume';
import {
  findVersion,
  readActiveVersion,
  readVersionNumber,
} from '@/features/suggestions/proposals/proposalVersions';
import type { Proposal } from '@/types/agentProposal';
import type { AgentToolRun, ToolAnswer, ToolCallContext } from '../tool-run/agentToolRun';
import { handleFor } from '../tool-run/resumeHandles';
import type { CompiledCall } from './compileProposeCall';
import {
  describeFlag,
  describeResultWeWrote,
  describeTarget,
  type ChangeAsAsked,
} from './describeForModel';
import { diagnose, formatToolAnswer, type Diagnostic } from './toolDiagnostics';
import { TOOL_FACTS } from './toolFacts';

/*
 * Finish a compiled propose call by staging accepted changes through
 * `suggestions/proposals/`. Then apply the staged changes to the run's receipt, and
 * report each result and its check findings to the model.
 *
 * A rewrite of text that an earlier suggestion wrote changes that suggestion. The model
 * gets the same answer as for a new suggestion, with the changed suggestion's checks. An
 * entry, line or bullet for a section or entry that an earlier suggestion made goes into
 * that suggestion, and is answered the same way.
 *
 * Once the user has kept a version of that suggestion, the change goes into a newer version
 * that waits for them. The working copy, and so read_document, still shows the kept
 * version. The receipt has to match the working copy, so the change is not applied to the
 * receipt. Instead, the answer tells the model which version it made.
 */

const NOTHING_STAGED: StagingResult = { proposals: [], reworded: [], filled: [], refusals: [] };

/** Return a new suggestion's change. The user hasn't seen it yet, so it is as the model sent it. */
function readNewAsAsked(proposal: Proposal): ChangeAsAsked {
  const { change, newContentIds, flags } = readActiveVersion(proposal);
  return { proposalId: proposal.id, source: proposal.source, change, newContentIds, flags };
}

/**
 * Return the rewrite the model asked for, with the checks of the version it changed.
 * The receipt and the answer need the rewrite as the model made it. The changed
 * suggestion can't be used for that, because it starts from the user's text and the
 * receipt holds the text the model last wrote.
 */
const readRewriteAsAsked = (
  { proposal, versionId }: RewordedSuggestion,
  asked: StagedChange
): ChangeAsAsked => ({
  proposalId: proposal.id,
  source: asked.source,
  change: asked.change,
  newContentIds: null,
  flags: findVersion(proposal, versionId).flags,
});

/**
 * Return what to tell the model when its change went into a version newer than the one
 * the user kept. Returns null when the change is in the version the working copy shows.
 */
function describeWaitingVersion({
  proposal,
  versionId,
}: RewordedSuggestion | FilledSuggestion): string | null {
  if (proposal.status !== 'accepted' || proposal.keptVersionId === versionId) return null;
  const kept = readVersionNumber(proposal, proposal.keptVersionId ?? '');
  return TOOL_FACTS.newerThanKept(kept, readVersionNumber(proposal, versionId));
}

/**
 * Return the entry, line or bullet the model asked for, which went into an earlier
 * suggestion. The receipt and the answer need it as the model made it, with its own ids
 * and its own checks.
 */
const readFillingAsAsked = (filled: FilledSuggestion, asked: StagedChange): ChangeAsAsked => ({
  proposalId: filled.proposal.id,
  source: asked.source,
  change: asked.change,
  newContentIds: filled.filledIds,
  flags: filled.filledFlags,
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
function applyToReceipt(run: AgentToolRun, made: ChangeAsAsked[], filled: FilledSuggestion[]) {
  if (!run.receipt || !made.length) return;
  const { doc } = applyProposalsToResume(run.receipt.doc, made);
  // A custom section's first entry makes it an entries section. Only its suggestion says so.
  for (const { proposal } of filled) {
    const { change, newContentIds } = readActiveVersion(proposal);
    if (change.kind !== 'section' || newContentIds?.kind !== 'section') continue;
    const section = doc.sections.find((each) => each.id === newContentIds.sectionId);
    if (section) section.layout = change.section.layout;
  }
  run.receipt = { ...run.receipt, doc };
}

/**
 * Describe a staged change and its checks, including any code-generated result text.
 * `waitingVersion` says which version the change made, when it is newer than the kept one.
 */
function describeStaged(
  run: AgentToolRun,
  staged: ChangeAsAsked,
  waitingVersion: string | null = null
): Diagnostic {
  // A flag on one bullet of a new entry names that bullet, so the model can fix only that bullet.
  const checks = staged.flags.map((flag) =>
    flag.textId
      ? `In ${handleFor(run.handles, 'bullet', flag.textId)}: ${describeFlag(flag)}`
      : describeFlag(flag)
  );
  const text = [
    'suggested.',
    describeResultWeWrote(run, staged),
    waitingVersion,
    `Checks: ${checks.length ? checks.join(' ') : 'none.'}`,
  ];
  return diagnose('ok', describeTarget(run, staged.change), text.filter(Boolean).join(' '));
}

const describeRemoved = (run: AgentToolRun, rewrite: ChangeAsAsked): Diagnostic =>
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
    waitingVersion: describeWaitingVersion(reworded),
  }));
  const fillings = staging.filled.map((filled) => ({
    filling: readFillingAsAsked(filled, compiled.toStage[filled.index]),
    waitingVersion: describeWaitingVersion(filled),
  }));
  const made = staging.proposals.map(readNewAsAsked);
  recordStagedIds(run, staging);
  // A version newer than the kept one isn't in the working copy, so it stays out of the receipt.
  const isShown = (each: { waitingVersion: string | null }) => each.waitingVersion === null;
  applyToReceipt(
    run,
    [
      ...made,
      ...rewrites.filter(isShown).map(({ rewrite }) => rewrite),
      ...fillings.filter(isShown).map(({ filling }) => filling),
    ],
    staging.filled.filter((_, index) => isShown(fillings[index]))
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
    ...made.map((staged) => describeStaged(run, staged)),
    ...rewrites.map(({ rewrite, isRemoved, waitingVersion }) =>
      isRemoved ? describeRemoved(run, rewrite) : describeStaged(run, rewrite, waitingVersion)
    ),
    ...fillings.map(({ filling, waitingVersion }) => describeStaged(run, filling, waitingVersion)),
    ...refused,
  ]);
}
