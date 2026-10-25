import { locateEveryPhrase } from '../locatePhrase';
import { findBulletInReceipt, isProblem } from './findInReceipt';
import { TOOL_FACTS } from './toolFacts';
import type { ProposeTool, Reading } from './toolReadings';

/**
 * Two bullets from one, split where the model's words start: models count characters
 * badly. Words that sit in the bullet more than once give a reading for each place.
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
