import { readShowPlaceId, readShownName } from '@/lib/resume/proposalAnchor';
import type { HandleKind } from '@shared/agent-tools/handleKinds';
import type { ShowPlace } from '@/types/agentProposal';
import type { Bullet, ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import {
  NO_RESUME_OPEN,
  type AgentToolRun,
  type ReadReceipt,
  type ToolCallContext,
} from '../tool-run/agentToolRun';
import { idForHandle, readHandleKind } from '../tool-run/resumeHandles';
import { TOOL_FACTS } from './toolFacts';

/*
 * What a propose call's handles name, found in the resume as the run read it, never the
 * draft as it is now: a suggestion's `before` comes from here, so staging can tell an edit
 * made since. The one place a handle is looked up; each finder gives back what it found,
 * or the facts to tell the model.
 */

export interface Problem {
  problem: string;
}

export const isProblem = (found: object): found is Problem => 'problem' in found;

/** A bullet as the run read it, with where it sat. */
export interface BulletInReceipt {
  sectionId: string;
  entry: ResumeEntry;
  bullet: Bullet;
}

/** What a handle of one of `kinds` names, and what the user sees of it: its `before`. */
export interface PlaceInReceipt<K extends HandleKind> {
  place: Extract<ShowPlace, { unit: K }>;
  before: string;
}

/** What the run read, if it is of the resume open now. */
export function openReceipt({ run, templateId }: ToolCallContext): ReadReceipt | Problem {
  if (templateId === null) return { problem: NO_RESUME_OPEN };
  if (!run.receipt) return { problem: TOOL_FACTS.notRead };
  if (run.receipt.templateId !== templateId) return { problem: TOOL_FACTS.otherResumeOpen };
  return run.receipt;
}

const unknownHandle = (kind: HandleKind, handle: string): Problem => ({
  problem: TOOL_FACTS.unknownHandle(kind, handle),
});

const notInReceipt = (handle: string): Problem => ({ problem: TOOL_FACTS.notInReceipt(handle) });

/** The handles the run gave these ids, as the model knows them. */
export const handlesOf = (run: AgentToolRun, ids: string[]) =>
  ids.map((id) => run.handles.handleById.get(id) ?? id);

export function findSectionInReceipt(
  context: ToolCallContext,
  handle: string
): ResumeSection | Problem {
  const receipt = openReceipt(context);
  if (isProblem(receipt)) return receipt;
  const sectionId = idForHandle(context.run.handles, 'section', handle);
  if (!sectionId) return unknownHandle('section', handle);
  return receipt.doc.sections.find((section) => section.id === sectionId) ?? notInReceipt(handle);
}

export function findEntryInSection(
  context: ToolCallContext,
  section: ResumeSection,
  handle: string
): ResumeEntry | Problem {
  const entryId = idForHandle(context.run.handles, 'entry', handle);
  if (!entryId) return unknownHandle('entry', handle);
  const entry = section.items.find((each) => each.id === entryId);
  if (entry) return entry;
  const [sectionHandle, ...entries] = handlesOf(context.run, [
    section.id,
    ...section.items.map((each) => each.id),
  ]);
  return { problem: TOOL_FACTS.entryNotInSection(handle, sectionHandle, entries) };
}

export function findBulletInReceipt(
  context: ToolCallContext,
  handle: string
): BulletInReceipt | Problem {
  const receipt = openReceipt(context);
  if (isProblem(receipt)) return receipt;
  const bulletId = idForHandle(context.run.handles, 'bullet', handle);
  if (!bulletId) return unknownHandle('bullet', handle);
  for (const section of receipt.doc.sections) {
    for (const entry of section.items) {
      const bullet = entry.bullets.find((each) => each.id === bulletId);
      if (bullet) return { sectionId: section.id, entry, bullet };
    }
  }
  return notInReceipt(handle);
}

/** Everything a handle can name, as places, in the order the resume holds them. */
function listPlaces(doc: ResumeData): ShowPlace[] {
  return doc.sections.flatMap((section): ShowPlace[] => {
    const sectionId = section.id;
    const items = section.items.flatMap((item): ShowPlace[] =>
      section.layout === 'lines'
        ? [{ unit: 'line', sectionId, lineId: item.id }]
        : [
            { unit: 'entry', sectionId, entryId: item.id },
            ...item.bullets.map((bullet): ShowPlace => ({
              unit: 'bullet',
              sectionId,
              entryId: item.id,
              bulletId: bullet.id,
            })),
          ]
    );
    return [{ unit: 'section', sectionId }, ...items];
  });
}

const isOfKind = <K extends HandleKind>(
  place: ShowPlace,
  kinds: readonly K[]
): place is Extract<ShowPlace, { unit: K }> =>
  (kinds as readonly HandleKind[]).includes(place.unit);

/** What a handle names, if its kind is one of `kinds`. */
function findPlaceInReceipt<K extends HandleKind>(
  context: ToolCallContext,
  handle: string,
  kinds: readonly K[]
): PlaceInReceipt<K> | Problem {
  const receipt = openReceipt(context);
  if (isProblem(receipt)) return receipt;
  const kind = readHandleKind(handle);
  if (!kind || !(kinds as readonly HandleKind[]).includes(kind)) {
    return { problem: TOOL_FACTS.wrongKind(handle, kinds) };
  }
  const id = idForHandle(context.run.handles, kind, handle);
  if (!id) return unknownHandle(kind, handle);
  const place = listPlaces(receipt.doc).find(
    (each) => each.unit === kind && readShowPlaceId(each) === id
  );
  if (!place || !isOfKind(place, kinds)) return notInReceipt(handle);
  return { place, before: readShownName(receipt.doc, place) ?? '' };
}

const TEXT_KINDS = ['bullet', 'line'] as const;
const SHOWABLE_KINDS = ['bullet', 'line', 'entry', 'section'] as const;

/** A bullet or a line, with its text. */
export const findTextInReceipt = (context: ToolCallContext, handle: string) =>
  findPlaceInReceipt(context, handle, TEXT_KINDS);

/** Anything that can leave the page, with its text, an entry's heading, or a section's label. */
export const findShowableInReceipt = (context: ToolCallContext, handle: string) =>
  findPlaceInReceipt(context, handle, SHOWABLE_KINDS);

/** Every bullet and line the run read. */
export function listTextInReceipt(
  context: ToolCallContext
): PlaceInReceipt<(typeof TEXT_KINDS)[number]>[] | Problem {
  const receipt = openReceipt(context);
  if (isProblem(receipt)) return receipt;
  return listPlaces(receipt.doc)
    .filter((place) => isOfKind(place, TEXT_KINDS))
    .map((place) => ({ place, before: readShownName(receipt.doc, place) ?? '' }));
}
