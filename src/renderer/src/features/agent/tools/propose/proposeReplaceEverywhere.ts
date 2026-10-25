import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import { replaceEveryWholeWord } from '../replaceEveryWholeWord';
import { isProblem, listTextInReceipt } from './findInReceipt';
import { TOOL_FACTS } from './toolFacts';
import { oneReading, type ProposeTool } from './toolReadings';

/**
 * One term renamed in every bullet and line that uses it, each its own suggestion. Headings
 * stay out: a heading is renamed on purpose, one at a time.
 */
export const proposeReplaceEverywhere: ProposeTool<'propose_replace_everywhere'> = (
  context,
  args
) => {
  const texts = listTextInReceipt(context);
  if (isProblem(texts)) return texts;
  const changes: StagedChange[] = [];
  for (const { place, before } of texts) {
    const replaced = replaceEveryWholeWord(before, args.find, args.replace);
    if (!replaced) continue;
    const change = { kind: 'rewrite' as const, place, before, after: replaced.text };
    changes.push({ change, source: 'replace', reason: args.reason });
  }
  if (!changes.length) return { problem: TOOL_FACTS.termInNoText(args.find) };
  return oneReading(...changes);
};
