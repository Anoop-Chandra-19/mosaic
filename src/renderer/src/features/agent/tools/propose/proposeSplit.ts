import { findBulletInReceipt, isProblem } from './findInReceipt';
import { locateEveryPhrase } from './locatePhrase';
import { TOOL_FACTS } from './toolFacts';
import type { ProposeTool, Reading } from './toolReadings';

/**
 * Split a bullet at the start of a model-supplied phrase rather than relying on the
 * model to count characters. Return one interpretation per matching phrase position.
 */
export const proposeSplit: ProposeTool<'propose_split'> = (context, args) => {
  const found = findBulletInReceipt(context, args.bulletId);
  if (isProblem(found)) return found;
  const text = found.bullet.text;
  const starts = locateEveryPhrase(text, args.secondStartsWith);
  if (!starts.length) {
    return { problem: TOOL_FACTS.phraseNotInBullet(args.secondStartsWith, args.bulletId) };
  }
  return starts.map(({ start }): Reading => {
    const change = {
      kind: 'split' as const,
      sectionId: found.sectionId,
      entryId: found.entry.id,
      bulletId: found.bullet.id,
      before: text,
      at: start,
    };
    const halves = `"${text.slice(0, start).trim()}" and "${text.slice(start).trim()}"`;
    return {
      changes: [{ change, source: 'split', reason: args.reason }],
      took: [],
      summary: halves,
    };
  });
};
