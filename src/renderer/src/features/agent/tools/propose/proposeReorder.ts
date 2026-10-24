import { readOrder } from '@/features/suggestions/proposals/proposalAnchor';
import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { OrderPlace } from '@shared/types/agentProposal';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import type { HandleKind } from '../resumeHandles';
import {
  findEntryInSection,
  findSectionInReceipt,
  idsForHandles,
  isProblem,
  openReceipt,
  type Problem,
} from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

type ReorderArgs = AgentToolArgs['propose_reorder'];

/** The list to reorder, and the kind of handle its order lists. */
function findOrderedList(
  run: AgentToolRun,
  { sectionId, entryId }: ReorderArgs
): { place: OrderPlace; itemKind: HandleKind } | Problem {
  if (!sectionId) {
    if (entryId) return { problem: 'Give the sectionId of the section the entry is in.' };
    return { place: { unit: 'sections' }, itemKind: 'section' };
  }
  const section = findSectionInReceipt(run, sectionId);
  if (isProblem(section)) return section;
  if (!entryId) {
    const itemKind = section.layout === 'lines' ? 'line' : 'entry';
    return { place: { unit: 'items', sectionId: section.id }, itemKind };
  }
  const entry = findEntryInSection(run, section, entryId);
  if (isProblem(entry)) return entry;
  return {
    place: { unit: 'bullets', sectionId: section.id, entryId: entry.id },
    itemKind: 'bullet',
  };
}

/** The sections, a section's entries or lines, or an entry's bullets, in a new order. */
export function proposeReorder(run: AgentToolRun, args: ReorderArgs): ToolAnswer {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return refuse(receipt.problem);
  const list = findOrderedList(run, args);
  if (isProblem(list)) return refuse(list.problem);
  const newOrder = idsForHandles(run, list.itemKind, args.order);
  if (isProblem(newOrder)) return refuse(newOrder.problem);

  const change = {
    kind: 'reorder' as const,
    place: list.place,
    before: readOrder(receipt.doc, list.place) ?? [],
    after: newOrder,
  };
  return stageSuggestions(run, [{ change, source: 'reorder', reason: args.reason }]);
}
