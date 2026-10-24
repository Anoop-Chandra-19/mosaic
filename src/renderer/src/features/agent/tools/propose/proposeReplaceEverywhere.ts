import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { replaceEveryWholeWord } from '../replaceEveryWholeWord';
import { isProblem, listTextInReceipt } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/**
 * One term renamed in every bullet and line that uses it, each its own suggestion. Headings
 * stay out: a heading is renamed on purpose, one at a time.
 */
export function proposeReplaceEverywhere(
  run: AgentToolRun,
  args: AgentToolArgs['propose_replace_everywhere']
): ToolAnswer {
  const texts = listTextInReceipt(run);
  if (isProblem(texts)) return refuse(texts.problem);

  const changes: StagedChange[] = [];
  for (const { place, before } of texts) {
    const replaced = replaceEveryWholeWord(before, args.find, args.replace);
    if (!replaced) continue;
    const change = { kind: 'rewrite' as const, place, before, after: replaced.text };
    changes.push({ change, source: 'replace', reason: args.reason });
  }
  if (!changes.length) {
    return refuse(
      `"${args.find}" is in no bullet or line. Copy find exactly as the resume writes it.`
    );
  }
  return stageSuggestions(run, changes);
}
