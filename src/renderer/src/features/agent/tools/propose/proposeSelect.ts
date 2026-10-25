import { findShowableInReceipt, isProblem } from './findInReceipt';
import { oneReading, type ProposeTool } from './toolReadings';

/**
 * A bullet, line, entry or section left off the page or put back. It stays in the resume
 * either way.
 */
export const proposeSelect: ProposeTool<'propose_select'> = (context, args) => {
  const found = findShowableInReceipt(context, args.id);
  if (isProblem(found)) return found;
  const change = {
    kind: 'select' as const,
    place: found.place,
    before: found.before,
    selected: args.show,
  };
  return oneReading({ change, source: 'select', reason: args.reason });
};
