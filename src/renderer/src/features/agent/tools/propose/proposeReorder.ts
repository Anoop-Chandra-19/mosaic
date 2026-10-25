import { readOrder, readShowPlaceId } from '@/features/suggestions/proposals/proposalAnchor';
import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { HandleKind } from '@shared/agent-tools/handleKinds';
import type { OrderPlace, ShowPlace } from '@shared/types/agentProposal';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import {
  findShowableInReceipt,
  handlesOf,
  isProblem,
  openReceipt,
  type Problem,
} from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

const ONE_OF_KIND: Record<HandleKind, string> = {
  section: 'a section',
  entry: 'an entry',
  bullet: 'a bullet',
  line: 'a line',
};

const KIND_PLURAL: Record<HandleKind, string> = {
  section: 'sections',
  entry: 'entries',
  bullet: 'bullets',
  line: 'lines',
};

/** "b1, b2 are bullets in e1", "e1 is an entry in s2", "s1 is a section". */
function describeHandlesInList(handles: string[], kind: HandleKind, holder: string | null) {
  const what = handles.length > 1 ? `are ${KIND_PLURAL[kind]}` : `is ${ONE_OF_KIND[kind]}`;
  return `${handles.join(', ')} ${what}${holder ? ` in ${holder}` : ''}`;
}

/** The list a thing sits in, and the id of what holds that list (none for the sections). */
function findListOf(place: ShowPlace): { list: OrderPlace; holderId: string | null } {
  switch (place.unit) {
    case 'section':
      return { list: { unit: 'sections' }, holderId: null };
    case 'entry':
    case 'line':
      return { list: { unit: 'items', sectionId: place.sectionId }, holderId: place.sectionId };
    case 'bullet':
      return {
        list: { unit: 'bullets', sectionId: place.sectionId, entryId: place.entryId },
        holderId: place.entryId,
      };
  }
}

/** The handles of an order that sit in one list. */
interface OrderGroup {
  list: OrderPlace;
  holderId: string | null;
  kind: HandleKind;
  handles: string[];
  ids: string[];
}

/** The order's handles, grouped by the list each sits in, or the first that names nothing. */
function groupByList(run: AgentToolRun, order: string[]): OrderGroup[] | Problem {
  const groups: OrderGroup[] = [];
  for (const handle of order) {
    const found = findShowableInReceipt(run, handle);
    if (isProblem(found)) return found;
    const { list, holderId } = findListOf(found.place);
    const id = readShowPlaceId(found.place);
    const kind = found.place.unit;
    const group = groups.find((each) => each.holderId === holderId && each.kind === kind);
    if (group) {
      group.handles.push(handle);
      group.ids.push(id);
    } else {
      groups.push({ list, holderId, kind, handles: [handle], ids: [id] });
    }
  }
  return groups;
}

/** The one list the order's handles are in, or the facts of the lists they are in. */
function findOrderedList(run: AgentToolRun, order: string[]): OrderGroup | Problem {
  const groups = groupByList(run, order);
  if (isProblem(groups)) return groups;
  if (groups.length === 0) {
    return { problem: 'order is empty. order is every handle of one list, in the new order.' };
  }
  if (groups.length === 1) return groups[0];
  const described = groups.map(({ handles, kind, holderId }) =>
    describeHandlesInList(handles, kind, holderId && handlesOf(run, [holderId])[0])
  );
  return {
    problem: `order mixes lists: ${described.join('; ')}. order is the handles of one list.`,
  };
}

const isEveryOnce = (before: string[], after: string[]) =>
  before.length === after.length &&
  new Set(after).size === after.length &&
  after.every((id) => before.includes(id));

/** The sections, a section's entries or lines, or an entry's bullets, in a new order. */
export function proposeReorder(
  run: AgentToolRun,
  args: AgentToolArgs['propose_reorder']
): ToolAnswer {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return refuse(receipt.problem);
  const ordered = findOrderedList(run, args.order);
  if (isProblem(ordered)) return refuse(ordered.problem);

  const before = readOrder(receipt.doc, ordered.list) ?? [];
  if (!isEveryOnce(before, ordered.ids)) {
    const list = handlesOf(run, before).join(', ');
    return refuse(
      `That list holds ${list}; order gives ${args.order.join(', ')}. order is every one of them, once.`
    );
  }
  const change = { kind: 'reorder' as const, place: ordered.list, before, after: ordered.ids };
  return stageSuggestions(run, [{ change, source: 'reorder', reason: args.reason }]);
}
