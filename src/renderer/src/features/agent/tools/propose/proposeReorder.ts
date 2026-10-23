import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { OrderPlace } from '@shared/types/agentProposal';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import {
  findEntryInSection,
  findSectionInReceipt,
  idsForHandles,
  isProblem,
} from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** A section's entries in a new order, or with `entryId` an entry's bullets. */
export function proposeReorder(
  run: AgentToolRun,
  args: AgentToolArgs['propose_reorder']
): ToolAnswer {
  const section = findSectionInReceipt(run, args.sectionId);
  if (isProblem(section)) return refuse(section.problem);

  let entry;
  if (args.entryId) {
    entry = findEntryInSection(run, section, args.entryId);
    if (isProblem(entry)) return refuse(entry.problem);
  }

  const orderNow = (entry ? entry.bullets : section.items).map(({ id }) => id);
  const newOrder = idsForHandles(run, entry ? 'bullet' : 'entry', args.order);
  if (isProblem(newOrder)) return refuse(newOrder.problem);

  const place: OrderPlace = entry
    ? { unit: 'bullets', sectionId: section.id, entryId: entry.id }
    : { unit: 'items', sectionId: section.id };
  const change = { kind: 'reorder' as const, place, before: orderNow, after: newOrder };
  return stageSuggestions(run, [{ change, source: 'reorder', reason: args.reason }]);
}
