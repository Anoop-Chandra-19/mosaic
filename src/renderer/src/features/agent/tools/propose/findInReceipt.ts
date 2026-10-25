import { readShowPlaceId, readShownName } from '@/features/suggestions/proposals/proposalAnchor';
import { useResumeStore } from '@/stores/resumeStore';
import type { ShowPlace } from '@shared/types/agentProposal';
import type { Bullet, ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { NO_RESUME_OPEN, type AgentToolRun, type ReadReceipt } from '../agentToolRun';
import type { HandleKind } from '@shared/agent-tools/handleKinds';
import { idForHandle, readHandleKind } from '../resumeHandles';

/*
 * What a propose tool's handles name, found in the resume as the run read it, never the
 * draft as it is now: a suggestion's `before` comes from here, so staging can tell an edit
 * made since. Each finder gives back what it found, or the problem to tell the model.
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
export function openReceipt(run: AgentToolRun): ReadReceipt | Problem {
  const { templateId } = useResumeStore.getState();
  if (templateId === null) return { problem: NO_RESUME_OPEN };
  if (!run.receipt) return { problem: 'Read the resume first, with read_document.' };
  if (run.receipt.templateId !== templateId) {
    return { problem: 'Another resume is open now. Read it with read_document.' };
  }
  return run.receipt;
}

const EXAMPLE_HANDLES: Record<HandleKind, string> = {
  section: 's1',
  entry: 'e1',
  bullet: 'b1',
  line: 'l1',
};

/** "a or b", "a, b or c". */
const listEither = (words: readonly string[]) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;

const unknownHandle = (kind: HandleKind, handle: string): Problem => ({
  problem: `No ${kind} "${handle}". Use a ${kind} handle from read_document, such as ${EXAMPLE_HANDLES[kind]}.`,
});

const wrongKind = (handle: string, kinds: readonly HandleKind[]): Problem => ({
  problem: `"${handle}" can't be used here. Use a ${listEither(kinds)} handle, such as ${listEither(kinds.map((kind) => EXAMPLE_HANDLES[kind]))}.`,
});

const notInReceipt = (handle: string): Problem => ({
  problem: `${handle} isn't in the resume as you last read it. Read it again.`,
});

export function findSectionInReceipt(run: AgentToolRun, handle: string): ResumeSection | Problem {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return receipt;
  const sectionId = idForHandle(run.handles, 'section', handle);
  if (!sectionId) return unknownHandle('section', handle);
  return receipt.doc.sections.find((section) => section.id === sectionId) ?? notInReceipt(handle);
}

export function findEntryInSection(
  run: AgentToolRun,
  section: ResumeSection,
  handle: string
): ResumeEntry | Problem {
  const entryId = idForHandle(run.handles, 'entry', handle);
  if (!entryId) return unknownHandle('entry', handle);
  const entry = section.items.find((each) => each.id === entryId);
  return entry ?? { problem: `${handle} isn't in that section.` };
}

export function findBulletInReceipt(run: AgentToolRun, handle: string): BulletInReceipt | Problem {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return receipt;
  const bulletId = idForHandle(run.handles, 'bullet', handle);
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
  run: AgentToolRun,
  handle: string,
  kinds: readonly K[]
): PlaceInReceipt<K> | Problem {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return receipt;
  const kind = readHandleKind(handle);
  if (!kind || !(kinds as readonly HandleKind[]).includes(kind)) return wrongKind(handle, kinds);
  const id = idForHandle(run.handles, kind, handle);
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
export const findTextInReceipt = (run: AgentToolRun, handle: string) =>
  findPlaceInReceipt(run, handle, TEXT_KINDS);

/** Anything that can leave the page, with its text, an entry's heading, or a section's label. */
export const findShowableInReceipt = (run: AgentToolRun, handle: string) =>
  findPlaceInReceipt(run, handle, SHOWABLE_KINDS);

/** Every bullet and line the run read. */
export function listTextInReceipt(
  run: AgentToolRun
): PlaceInReceipt<(typeof TEXT_KINDS)[number]>[] | Problem {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return receipt;
  return listPlaces(receipt.doc)
    .filter((place) => isOfKind(place, TEXT_KINDS))
    .map((place) => ({ place, before: readShownName(receipt.doc, place) ?? '' }));
}

/** The handles the run gave these ids, as the model knows them. */
export const handlesOf = (run: AgentToolRun, ids: string[]) =>
  ids.map((id) => run.handles.handleById.get(id) ?? id);
