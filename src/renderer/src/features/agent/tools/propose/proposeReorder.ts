import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import { isPlaceShown, readOrder, readShowPlaceId } from '@/lib/resume/proposalAnchor';
import type { HandleKind } from '@shared/agent-tools/handleKinds';
import type { OrderPlace, ShowPlace } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import type { AgentToolRun, ToolCallContext } from '../tool-run/agentToolRun';
import {
  findShowableInReceipt,
  handlesOf,
  isProblem,
  openReceipt,
  type Problem,
} from './findInReceipt';
import { describeList, TOOL_FACTS } from './toolFacts';
import type { ProposeTool } from './toolReadings';

/*
 * Compile `order` as a resume outline. Group handles by their containing list and
 * apply each group's supplied order. Groups already in document order do not change,
 * so listing "e1" before its bullets can reorder only the bullets.
 * Reorder a whole list or a contiguous subset within its existing slots, leaving other
 * items in place. Refuse noncontiguous subsets as ambiguous and report the current list.
 * Each changed list becomes a separate suggestion.
 */

/** Handles and IDs from one list, in the order supplied by the call. */
interface NamedList {
  place: OrderPlace;
  kind: HandleKind;
  /** What holds the list: a section, an entry, or null for the sections themselves. */
  holderId: string | null;
  handles: string[];
  ids: string[];
}

/** Identify a place's containing list and the list's parent ID. */
function findListOf(place: ShowPlace): Pick<NamedList, 'place' | 'holderId'> {
  switch (place.unit) {
    case 'section':
      return { place: { unit: 'sections' }, holderId: null };
    case 'entry':
    case 'line':
      return { place: { unit: 'items', sectionId: place.sectionId }, holderId: place.sectionId };
    case 'bullet':
      return {
        place: { unit: 'bullets', sectionId: place.sectionId, entryId: place.entryId },
        holderId: place.entryId,
      };
  }
}

/** Convert a list item's ID to a place so its page visibility can be checked. */
function placeInList(list: OrderPlace, kind: HandleKind, id: string): ShowPlace {
  if (list.unit === 'sections') return { unit: 'section', sectionId: id };
  if (list.unit === 'bullets') return { ...list, unit: 'bullet', bulletId: id };
  return kind === 'line'
    ? { unit: 'line', sectionId: list.sectionId, lineId: id }
    : { unit: 'entry', sectionId: list.sectionId, entryId: id };
}

type FoundLists = { lists: NamedList[] } | Problem;

/** The order's handles, grouped by the list each sits in. */
function groupByList(context: ToolCallContext, order: string[]): FoundLists {
  const lists: NamedList[] = [];
  const seen = new Set<string>();
  for (const handle of order) {
    const found = findShowableInReceipt(context, handle);
    if (isProblem(found)) return found;
    const id = readShowPlaceId(found.place);
    if (seen.has(id)) return { problem: TOOL_FACTS.orderRepeats(handle) };
    seen.add(id);
    const { place, holderId } = findListOf(found.place);
    const kind = found.place.unit;
    const list = lists.find((each) => each.holderId === holderId && each.kind === kind);
    if (list) {
      list.handles.push(handle);
      list.ids.push(id);
    } else {
      lists.push({ place, kind, holderId, handles: [handle], ids: [id] });
    }
  }
  return lists.length ? { lists } : { problem: TOOL_FACTS.orderEmpty };
}

/** "b2", or "b2 (hidden)" for one left off the page, which still counts in its list. */
function describeItem(run: AgentToolRun, doc: ResumeData, list: NamedList, id: string) {
  const [handle] = handlesOf(run, [id]);
  const isShown = isPlaceShown(doc, placeInList(list.place, list.kind, id)) !== false;
  return isShown ? handle : `${handle} (hidden)`;
}

/** Compile a list's before/after order, or explain why the requested order is ambiguous. */
function compileListOrder(
  run: AgentToolRun,
  doc: ResumeData,
  list: NamedList
): { before: string[]; after: string[] } | Problem {
  const before = readOrder(doc, list.place) ?? [];
  const isNamed = (id: string) => list.ids.includes(id);
  const keptOrder = before.filter(isNamed);
  if (keptOrder.every((id, index) => id === list.ids[index])) return { before, after: before };

  const slots = before.flatMap((id, index) => (isNamed(id) ? [index] : []));
  const between = before.slice(slots[0], slots.at(-1)! + 1).filter((id) => !isNamed(id));
  if (between.length) {
    const holder = list.holderId && handlesOf(run, [list.holderId])[0];
    return {
      problem: TOOL_FACTS.orderApart(
        describeList(list.kind, holder),
        list.handles,
        between.map((id) => describeItem(run, doc, list, id)),
        before.map((id) => describeItem(run, doc, list, id))
      ),
    };
  }
  const after = [...before];
  slots.forEach((slot, index) => (after[slot] = list.ids[index]));
  return { before, after };
}

const isWholeList = (list: NamedList, before: string[]) => list.ids.length === before.length;

/** The sections, a section's entries or lines, or an entry's bullets, in a new order. */
export const proposeReorder: ProposeTool<'propose_reorder'> = (context, args) => {
  const receipt = openReceipt(context);
  if (isProblem(receipt)) return receipt;
  const found = groupByList(context, args.order);
  if (isProblem(found)) return found;

  const compiled = [];
  for (const list of found.lists) {
    const order = compileListOrder(context.run, receipt.doc, list);
    if (isProblem(order)) return order;
    compiled.push({ list, ...order });
  }
  const changed = compiled.filter(({ before, after }) => after.some((id, i) => id !== before[i]));
  // Keep one unchanged list so changeRules can report the call as a no-op.
  const staged = changed.length ? changed : compiled.slice(0, 1);
  const isPlain = compiled.length === 1 && isWholeList(compiled[0].list, compiled[0].before);

  const changes = staged.map(({ list, before, after }): StagedChange => ({
    change: { kind: 'reorder', place: list.place, before, after },
    source: 'reorder',
    reason: args.reason,
  }));
  const took = isPlain
    ? []
    : changed.map(({ list, after }) => {
        const holder = list.holderId && handlesOf(context.run, [list.holderId])[0];
        const order = handlesOf(context.run, after).join(', ');
        return `Took order as ${describeList(list.kind, holder)}: ${order}.`;
      });
  return [{ changes, took, summary: '' }];
};
