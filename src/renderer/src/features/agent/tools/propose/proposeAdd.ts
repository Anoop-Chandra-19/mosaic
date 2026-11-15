import { hasSameWords } from '@/lib/resume/hasSameWords';
import type { AddPlace, ProposalChange } from '@/types/agentProposal';
import type { ProposeToolArgs } from '@shared/agent-tools/proposeTools';
import type { ToolCallContext } from '../tool-run/agentToolRun';
import { idForHandle, readHandleKind } from '../tool-run/resumeHandles';
import {
  findEntryInReceipt,
  findSectionInReceipt,
  findTextInReceipt,
  handlesOf,
  isProblem,
  type Problem,
} from './findInReceipt';
import { describeList, TOOL_FACTS } from './toolFacts';
import { oneReading, type ProposeTool, type Reading } from './toolReadings';
import { LIST_SEPARATORS, writeListItem, type ListItemFailure } from './writeListItem';

type AddArgs = ProposeToolArgs['propose_add'];

type Gap = { withoutNumber: string } | undefined;

/** The list that receives the new text: an entry's bullets or a section's lines. */
interface TextList {
  place: AddPlace;
  /** The handle of the entry or section that contains the list. */
  holder: string;
  items: { id: string; text: string }[];
  adjustments: string[];
}

/**
 * Find the list that the `into` handle refers to. If `into` is a section with exactly
 * one entry, use that entry's bullets and report the adjustment, because the entry is
 * the only place in the section where a new bullet can go.
 */
function findTextList(context: ToolCallContext, into: string): TextList | Problem {
  if (readHandleKind(into) === 'entry') {
    const found = findEntryInReceipt(context, into);
    if (isProblem(found)) return found;
    const place: AddPlace = { unit: 'bullet', sectionId: found.sectionId, entryId: found.entry.id };
    return { place, holder: into, items: found.entry.bullets, adjustments: [] };
  }
  const section = findSectionInReceipt(context, into);
  if (isProblem(section)) return section;
  if (section.layout === 'lines') {
    const items = section.items.map(({ id, text }) => ({ id, text: text ?? '' }));
    return { place: { unit: 'line', sectionId: section.id }, holder: into, items, adjustments: [] };
  }
  const entryHandles = handlesOf(
    context.run,
    section.items.map((entry) => entry.id)
  );
  const [onlyEntry, ...otherEntries] = section.items;
  if (!onlyEntry || otherEntries.length) {
    return { problem: TOOL_FACTS.sectionHoldsEntries(into, entryHandles) };
  }
  return {
    place: { unit: 'bullet', sectionId: section.id, entryId: onlyEntry.id },
    holder: entryHandles[0],
    items: onlyEntry.bullets,
    adjustments: [`Took ${into} as its one entry, ${entryHandles[0]}.`],
  };
}

/**
 * Return the ID of the bullet or line that the new text is placed after. A null ID
 * places the new text first. `after` can be a handle from the list or the exact text of
 * one item in the list.
 */
function findPreviousText(
  context: ToolCallContext,
  list: TextList,
  after: string | undefined
): { id: string | null; adjustments: string[] } | Problem {
  if (after === undefined) return { id: list.items.at(-1)?.id ?? null, adjustments: [] };
  if (after.trim().toLowerCase() === 'start') return { id: null, adjustments: [] };
  const kind = list.place.unit;
  const idByHandle = idForHandle(context.run.handles, kind, after);
  const ids = list.items.map((item) => item.id);
  if (idByHandle && ids.includes(idByHandle)) return { id: idByHandle, adjustments: [] };

  const byWords = list.items.filter((item) => hasSameWords(item.text, after));
  if (byWords.length === 1) {
    const [handle] = handlesOf(context.run, [byWords[0].id]);
    return { id: byWords[0].id, adjustments: [`Took ${JSON.stringify(after)} as "${handle}".`] };
  }
  const listName = describeList(kind, list.holder);
  return { problem: TOOL_FACTS.notInList(after, listName, handlesOf(context.run, ids)) };
}

/** Propose a new bullet in an entry or a new line in a section with the lines layout. */
function proposeNewText(context: ToolCallContext, args: AddArgs, gap: Gap): Reading[] | Problem {
  const list = findTextList(context, args.into);
  if (isProblem(list)) return list;
  const previous = findPreviousText(context, list, args.after);
  if (isProblem(previous)) return previous;
  const change: Extract<ProposalChange, { kind: 'add' }> = {
    kind: 'add',
    place: list.place,
    afterId: previous.id,
    text: args.text.trim(),
  };
  if (gap) change.gap = gap;
  return [
    {
      changes: [{ change, source: 'add', reason: args.reason }],
      adjustments: [...list.adjustments, ...previous.adjustments],
      summary: '',
    },
  ];
}

const LIST_ITEM_PROBLEMS: Record<ListItemFailure, (args: AddArgs, lineText: string) => string> = {
  notAList: ({ into }) => TOOL_FACTS.lineIsNotAList(into, LIST_SEPARATORS),
  afterNotListed: ({ into, after }, lineText) => TOOL_FACTS.notAnItem(after ?? '', into, lineText),
};

/**
 * Propose a new item in a line that is a separated list, such as "Go, Python". This
 * function builds the new line itself, so the existing items stay unchanged and only
 * the requested item is added. The change is staged as a rewrite of the line.
 */
function proposeListItem(context: ToolCallContext, args: AddArgs, gap: Gap): Reading[] | Problem {
  const found = findTextInReceipt(context, args.into);
  if (isProblem(found)) return found;
  const written = writeListItem(found.before, args.text.trim(), args.after);
  if ('failure' in written) {
    return { problem: LIST_ITEM_PROBLEMS[written.failure](args, found.before) };
  }
  const change: Extract<ProposalChange, { kind: 'rewrite' }> = {
    kind: 'rewrite',
    place: found.place,
    before: found.before,
    after: written.line,
  };
  const withoutNumber = gap && writeListItem(found.before, gap.withoutNumber, args.after);
  if (withoutNumber && 'line' in withoutNumber) change.gap = { withoutNumber: withoutNumber.line };
  return oneReading({ change, source: 'add', reason: args.reason });
}

/**
 * Propose new text. The kind of handle in `into` decides what is added: an entry gets a
 * new bullet, a section with the lines layout gets a new line, and a line gets a new
 * list item. Text containing `{{?}}` must also include a `withoutNumber` alternative.
 */
export const proposeAdd: ProposeTool<'propose_add'> = (context, args) => {
  const hasGap = args.text.includes('{{?}}');
  if (hasGap && !args.withoutNumber) return { problem: TOOL_FACTS.gapWithoutNumber };
  const gap =
    hasGap && args.withoutNumber ? { withoutNumber: args.withoutNumber.trim() } : undefined;
  return readHandleKind(args.into) === 'line'
    ? proposeListItem(context, args, gap)
    : proposeNewText(context, args, gap);
};
