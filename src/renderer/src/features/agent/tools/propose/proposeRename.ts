import { findSectionInReceipt, isProblem } from './findInReceipt';
import { oneReading, type ProposeTool } from './toolReadings';

/** Propose a section heading; headings are wording, not factual claims for content checks. */
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
