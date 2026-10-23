import type { StagedChange } from '@/features/agent/proposals/proposalActions';
import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { replaceEveryWholeWord } from '../replaceEveryWholeWord';
import { isProblem, listBulletsInReceipt } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** One term renamed in every bullet that uses it, each bullet its own suggestion. */
export function proposeReplaceEverywhere(
  run: AgentToolRun,
  args: AgentToolArgs['propose_replace_everywhere']
): ToolAnswer {
  const bullets = listBulletsInReceipt(run);
  if (isProblem(bullets)) return refuse(bullets.problem);

  const changes: StagedChange[] = [];
  for (const { sectionId, entry, bullet } of bullets) {
    const replaced = replaceEveryWholeWord(bullet.text, args.find, args.replace);
    if (!replaced) continue;
    const change = {
      kind: 'rewrite' as const,
      sectionId,
      entryId: entry.id,
      bulletId: bullet.id,
      before: bullet.text,
      after: replaced.text,
    };
    changes.push({ change, source: 'replace', reason: args.reason });
  }
  if (!changes.length) {
    return refuse(`"${args.find}" is in no bullet. Copy find exactly as the bullets write it.`);
  }
  return stageSuggestions(run, changes);
}
