/**
 * Short names for a run's sections, entries and bullets ("s1", "e2", "b7"), which a model
 * copies back far more reliably than ids. Given in reading order the first time each is
 * seen, and kept for the whole run, so b7 is the same bullet in every read.
 */

export type HandleKind = 'section' | 'entry' | 'bullet';

const HANDLE_PREFIXES: Record<HandleKind, string> = { section: 's', entry: 'e', bullet: 'b' };

export interface ResumeHandles {
  handleById: Map<string, string>;
  idByHandle: Map<string, string>;
  givenSoFar: Record<HandleKind, number>;
}

export const createResumeHandles = (): ResumeHandles => ({
  handleById: new Map(),
  idByHandle: new Map(),
  givenSoFar: { section: 0, entry: 0, bullet: 0 },
});

/** The handle this id already has, or the next one of its kind. */
export function handleFor(handles: ResumeHandles, kind: HandleKind, id: string): string {
  const existing = handles.handleById.get(id);
  if (existing) return existing;
  handles.givenSoFar[kind] += 1;
  const handle = `${HANDLE_PREFIXES[kind]}${handles.givenSoFar[kind]}`;
  handles.handleById.set(id, handle);
  handles.idByHandle.set(handle, id);
  return handle;
}

/** The id a handle stands for, if it names one of `kind`. */
export function idForHandle(
  handles: ResumeHandles,
  kind: HandleKind,
  handle: string
): string | undefined {
  const typed = handle.trim().toLowerCase();
  return typed.startsWith(HANDLE_PREFIXES[kind]) ? handles.idByHandle.get(typed) : undefined;
}
