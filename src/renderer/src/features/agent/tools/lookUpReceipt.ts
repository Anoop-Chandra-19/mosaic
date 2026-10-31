import { hasSameWords } from '@/lib/resume/diffWords';
import type { AgentToolRun } from './agentToolRun';
import { readEntryHeading } from './formatResumeForModel';
import type { ResumeLookup } from './readAgentToolArgs';

/** Something the run read, by its handle, with its words and what holds it. */
interface ReadThing {
  handle: string;
  words: string;
  holder: string | null;
}

/** Everything the run read and gave a handle, sections first. */
function listReadThings(run: AgentToolRun): ReadThing[] {
  const doc = run.receipt?.doc;
  if (!doc) return [];
  const handleOf = (id: string) => run.handles.handleById.get(id);
  const things: ReadThing[] = [];
  const add = (id: string, words: string, holder: string | null) => {
    const handle = handleOf(id);
    if (handle) things.push({ handle, words, holder });
  };
  for (const section of doc.sections) {
    add(section.id, section.label, null);
    const sectionHandle = handleOf(section.id) ?? null;
    for (const item of section.items) {
      if (section.layout === 'lines') {
        add(item.id, item.text ?? '', sectionHandle);
        continue;
      }
      add(item.id, readEntryHeading(item), sectionHandle);
      const entryHandle = handleOf(item.id) ?? null;
      for (const bullet of item.bullets) add(bullet.id, bullet.text, entryHandle);
    }
  }
  return things;
}

/** What reading a call's arguments needs of the resume as the run read it. */
export function lookUpReceipt(run: AgentToolRun): ResumeLookup {
  const things = listReadThings(run);
  const holderOf = new Map(things.map((thing) => [thing.handle, thing.holder]));
  const holds = (holder: string, handle: string): boolean => {
    const heldBy = holderOf.get(handle);
    if (!heldBy) return false;
    return heldBy === holder || holds(holder, heldBy);
  };
  const findByText = (text: string) => {
    const matches = things.filter((thing) => hasSameWords(thing.words, text));
    return matches.length === 1 ? matches[0].handle : null;
  };
  return { findByText, holds };
}
