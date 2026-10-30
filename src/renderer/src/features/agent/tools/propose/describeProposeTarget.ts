import type { ProposeToolArgs, ProposeToolName } from '@shared/agent-tools/proposeTools';
import type { ToolTarget } from '@shared/types/agentConversation';
import type { ShowPlace } from '@shared/types/agentProposal';
import type { ResumeData, ResumeEntry } from '@shared/types/resume';
import type { ToolCallContext } from '../agentToolRun';
import { replaceEveryWholeWord } from '../replaceEveryWholeWord';
import { readHandleKind } from '../resumeHandles';
import {
  findSectionInReceipt,
  findShowableInReceipt,
  isProblem,
  listTextInReceipt,
  openReceipt,
} from './findInReceipt';

/*
 * What a propose call is about, named as the run read it, whether or not it goes on to stage
 * anything: the pane says what a refused step tried too. A handle the run can't find leaves
 * the call with no target, and the model hears why from the call itself.
 */

type PlaceTarget = Extract<ToolTarget, { kind: 'place' }>;

const nameEntry = ({ organization, title }: Pick<ResumeEntry, 'organization' | 'title'>) =>
  organization || title || undefined;

const withEntry = (target: PlaceTarget, entry: ResumeEntry | undefined): PlaceTarget => {
  const name = entry && nameEntry(entry);
  return name ? { ...target, entry: name } : target;
};

function describePlace(doc: ResumeData, place: ShowPlace): PlaceTarget | undefined {
  const section = doc.sections.find(({ id }) => id === place.sectionId);
  if (!section) return undefined;
  const target: PlaceTarget = { kind: 'place', section: section.label };
  switch (place.unit) {
    case 'section':
      return target;
    case 'line':
      return {
        ...target,
        line: section.items.findIndex(({ id }) => id === place.lineId) + 1,
      };
    case 'entry':
      return withEntry(
        target,
        section.items.find(({ id }) => id === place.entryId)
      );
    case 'bullet': {
      const entry = section.items.find(({ id }) => id === place.entryId);
      const bullet = (entry?.bullets.findIndex(({ id }) => id === place.bulletId) ?? -1) + 1;
      return { ...withEntry(target, entry), bullet };
    }
  }
}

function targetOfHandle(context: ToolCallContext, handle: string): PlaceTarget | undefined {
  const receipt = openReceipt(context);
  const found = findShowableInReceipt(context, handle);
  if (isProblem(receipt) || isProblem(found)) return undefined;
  return describePlace(receipt.doc, found.place);
}

/** The list the first handle sits in; the rest are the call's own to get right. */
function targetOfOrder(
  context: ToolCallContext,
  [first]: readonly string[]
): ToolTarget | undefined {
  const place = first === undefined ? undefined : targetOfHandle(context, first);
  if (!place) return undefined;
  const { section, entry } = place;
  switch (readHandleKind(first)) {
    case 'bullet':
      return { kind: 'list', of: 'bullet', section, ...(entry && { entry }) };
    case 'line':
      return { kind: 'list', of: 'line', section };
    case 'entry':
      return { kind: 'list', of: 'entry', section };
    default:
      return { kind: 'list', of: 'section' };
  }
}

const DESCRIBE_BY_TOOL: {
  [N in ProposeToolName]: (
    context: ToolCallContext,
    args: ProposeToolArgs[N]
  ) => ToolTarget | undefined;
} = {
  propose_rewrite: (context, { id }) => targetOfHandle(context, id),
  propose_rename: (context, { sectionId }) => targetOfHandle(context, sectionId),
  propose_split: (context, { bulletId }) => targetOfHandle(context, bulletId),
  propose_merge: (context, { firstBulletId, secondBulletId }) => {
    const first = targetOfHandle(context, firstBulletId);
    const second = targetOfHandle(context, secondBulletId);
    return first && { ...first, ...(second?.bullet && { lastBullet: second.bullet }) };
  },
  propose_select: (context, { id, show }) => {
    const place = targetOfHandle(context, id);
    return place && { ...place, show };
  },
  propose_reorder: (context, { order }) => targetOfOrder(context, order),
  propose_entry: (context, { sectionId, organization, title }) => {
    const section = findSectionInReceipt(context, sectionId);
    if (isProblem(section)) return undefined;
    const entry = nameEntry({ organization, title });
    return { kind: 'place', section: section.label, ...(entry && { entry }) };
  },
  propose_replace_everywhere: (context, { find, replace }) => {
    const texts = listTextInReceipt(context);
    if (isProblem(texts)) return undefined;
    const count = texts.filter(({ before }) => replaceEveryWholeWord(before, find, replace)).length;
    return { kind: 'term', find, replace, count };
  },
};

export function describeProposeTarget<N extends ProposeToolName>(
  context: ToolCallContext,
  name: N,
  args: ProposeToolArgs[N]
): ToolTarget | undefined {
  return DESCRIBE_BY_TOOL[name](context, args);
}
