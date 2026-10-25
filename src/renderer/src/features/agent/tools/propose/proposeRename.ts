import { findSectionInReceipt, isProblem } from './findInReceipt';
import { oneReading, type ProposeTool } from './toolReadings';

/** A section's new heading: the user's words, not a claim, so no checks run on it. */
export const proposeRename: ProposeTool<'propose_rename'> = (context, args) => {
  const section = findSectionInReceipt(context, args.sectionId);
  if (isProblem(section)) return section;
  const change = {
    kind: 'rename' as const,
    sectionId: section.id,
    before: section.label,
    after: args.label.trim(),
  };
  return oneReading({ change, source: 'rename', reason: args.reason });
};
