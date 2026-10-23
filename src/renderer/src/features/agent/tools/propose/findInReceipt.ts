import { useResumeStore } from '@/stores/resumeStore';
import type { TextPlace } from '@shared/types/agentProposal';
import type { Bullet, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { NO_RESUME_OPEN, type AgentToolRun, type ReadReceipt } from '../agentToolRun';
import { idForHandle, type HandleKind } from '../resumeHandles';

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

/** A found bullet as a suggestion names it. */
export const placeOfBullet = ({ sectionId, entry, bullet }: BulletInReceipt): TextPlace => ({
  unit: 'bullet',
  sectionId,
  entryId: entry.id,
  bulletId: bullet.id,
});

/** What the run read, if it is of the resume open now. */
function openReceipt(run: AgentToolRun): ReadReceipt | Problem {
  const { templateId } = useResumeStore.getState();
  if (templateId === null) return { problem: NO_RESUME_OPEN };
  if (!run.receipt) return { problem: 'Read the resume first, with read_document.' };
  if (run.receipt.templateId !== templateId) {
    return { problem: 'Another resume is open now. Read it with read_document.' };
  }
  return run.receipt;
}

const EXAMPLE_HANDLES: Record<HandleKind, string> = { section: 's1', entry: 'e1', bullet: 'b1' };

const unknownHandle = (kind: HandleKind, handle: string): Problem => ({
  problem: `No ${kind} "${handle}". Use a ${kind} handle from read_document, such as ${EXAMPLE_HANDLES[kind]}.`,
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

/** Every bullet the run read. */
export function listBulletsInReceipt(run: AgentToolRun): BulletInReceipt[] | Problem {
  const receipt = openReceipt(run);
  if (isProblem(receipt)) return receipt;
  return receipt.doc.sections.flatMap((section) =>
    section.items.flatMap((entry) =>
      entry.bullets.map((bullet) => ({ sectionId: section.id, entry, bullet }))
    )
  );
}

export function findBulletInReceipt(run: AgentToolRun, handle: string): BulletInReceipt | Problem {
  const bullets = listBulletsInReceipt(run);
  if (isProblem(bullets)) return bullets;
  const bulletId = idForHandle(run.handles, 'bullet', handle);
  if (!bulletId) return unknownHandle('bullet', handle);
  return bullets.find(({ bullet }) => bullet.id === bulletId) ?? notInReceipt(handle);
}

/** A list of handles of one kind, as ids, or the first that names nothing. */
export function idsForHandles(
  run: AgentToolRun,
  kind: HandleKind,
  handles: string[]
): string[] | Problem {
  const ids: string[] = [];
  for (const handle of handles) {
    const id = idForHandle(run.handles, kind, handle);
    if (!id) return unknownHandle(kind, handle);
    ids.push(id);
  }
  return ids;
}
