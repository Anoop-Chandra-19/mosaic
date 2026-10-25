import type { ProposeToolArgs } from '@shared/agent-tools/proposeTools';
import type { AgentToolRun } from '../agentToolRun';
import { findBulletInReceipt, handlesOf, isProblem, type BulletInReceipt } from './findInReceipt';
import { TOOL_FACTS } from './toolFacts';
import type { ProposeTool } from './toolReadings';

/** Why these two can't be merged as they sit, in facts; null when they sit side by side. */
function findApartProblem(
  run: AgentToolRun,
  args: ProposeToolArgs['propose_merge'],
  first: BulletInReceipt,
  second: BulletInReceipt
): string | null {
  if (first.entry.id !== second.entry.id) {
    const [firstEntry, secondEntry] = handlesOf(run, [first.entry.id, second.entry.id]);
    return TOOL_FACTS.bulletsInTwoEntries(
      args.firstBulletId,
      firstEntry,
      args.secondBulletId,
      secondEntry
    );
  }
  const bulletIds = first.entry.bullets.map((bullet) => bullet.id);
  const gap = bulletIds.indexOf(second.bullet.id) - bulletIds.indexOf(first.bullet.id);
  if (Math.abs(gap) === 1) return null;
  const [entry, ...bullets] = handlesOf(run, [first.entry.id, ...bulletIds]);
  return TOOL_FACTS.bulletsApart(args.firstBulletId, args.secondBulletId, entry, bullets);
}

/**
 * Two bullets of one entry that sit side by side, as one. Given in the other order, they
 * are still one pair, so that is taken and said.
 */
export const proposeMerge: ProposeTool<'propose_merge'> = (context, args) => {
  const givenFirst = findBulletInReceipt(context, args.firstBulletId);
  if (isProblem(givenFirst)) return givenFirst;
  const givenSecond = findBulletInReceipt(context, args.secondBulletId);
  if (isProblem(givenSecond)) return givenSecond;
  const problem = findApartProblem(context.run, args, givenFirst, givenSecond);
  if (problem) return { problem };

  const { bullets } = givenFirst.entry;
  const isSwapped = bullets.indexOf(givenFirst.bullet) > bullets.indexOf(givenSecond.bullet);
  const [first, second] = isSwapped ? [givenSecond, givenFirst] : [givenFirst, givenSecond];
  const change = {
    kind: 'merge' as const,
    sectionId: first.sectionId,
    entryId: first.entry.id,
    firstId: first.bullet.id,
    secondId: second.bullet.id,
    before: [first.bullet.text, second.bullet.text] as [string, string],
    after: args.text.trim(),
  };
  const [firstHandle, secondHandle] = handlesOf(context.run, [first.bullet.id, second.bullet.id]);
  const took = isSwapped
    ? [`Took them in the order they sit: ${firstHandle}, then ${secondHandle}.`]
    : [];
  return [{ changes: [{ change, source: 'merge', reason: args.reason }], took, summary: '' }];
};
