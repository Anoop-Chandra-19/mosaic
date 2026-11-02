import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import { isProblem, listTextInReceipt } from './findInReceipt';
import { replaceEveryWholeWord } from './replaceEveryWholeWord';
import { TOOL_FACTS } from './toolFacts';
import { oneReading, type ProposeTool } from './toolReadings';

/**
 * Rename a term in every matching bullet and line, with one suggestion per text item.
 * Exclude headings; rename section headings individually with propose_rename.
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
