import type { Bullet, ResumeData, ResumeEntry } from '@shared/types/resume';
import { pickBetween, pickFrom, pickIndex, type SeededRandom } from './seededRandom';

const VERBS = ['Rebuilt', 'Cut', 'Led', 'Wrote', 'Shipped', 'Measured', 'Untangled', 'Moved'];
const WORDS = [
  'dispatch',
  'queue',
  'ledger',
  'engine',
  'tables',
  'batch',
  'stream',
  'review',
  'budget',
  'rollout',
  'incident',
  'runbook',
  'migration',
  'forecast',
  'audit',
  'handover',
];

/** A bullet's worth of made-up work, as long as a real one. */
export function writeSentence(random: SeededRandom): string {
  const words = Array.from({ length: pickBetween(random, 10, 22) }, () => pickFrom(random, WORDS));
  const percent = pickBetween(random, 5, 95);
  return `${pickFrom(random, VERBS)} the ${words.join(' ')}, ${percent}% faster.`;
}

/** What one editing session does to a resume. */
export interface ResumeEdit {
  /** Bullets reworded. */
  rewrites: number;
  /** A bullet added at the end of an entry. */
  addsBullet?: boolean;
  /** A bullet removed from an entry that keeps at least two. */
  removesBullet?: boolean;
  /** The name at the top of the page. */
  contactName?: string;
}

/** Where an entry sits, so an edit can put its changed copy there. */
interface EntryPlace {
  items: ResumeEntry[];
  index: number;
}

/**
 * A changed copy that shares what it leaves alone with `doc`, which stays as it was: versions
 * keep the documents they hold, and a long history then holds each bullet once, not once a
 * version.
 */
export function editResume(
  doc: ResumeData,
  edit: ResumeEdit,
  random: SeededRandom,
  nextBulletId: () => string
): ResumeData {
  const sections = doc.sections.map((section) => ({ ...section, items: [...section.items] }));
  const contact =
    edit.contactName === undefined ? doc.contact : { ...doc.contact, name: edit.contactName };
  const edited: ResumeData = { ...doc, contact, sections };
  const places: EntryPlace[] = sections
    .flatMap((section) => section.items.map((_, index) => ({ items: section.items, index })))
    .filter(({ items, index }) => items[index].bullets.length > 0);
  if (places.length === 0) return edited;

  const copies = new Set<ResumeEntry>();
  /** The entry at `place`, copied the first time this edit changes it. */
  const changeEntry = (place: EntryPlace): ResumeEntry => {
    const entry = place.items[place.index];
    if (copies.has(entry)) return entry;
    const copy = { ...entry, bullets: [...entry.bullets] };
    place.items[place.index] = copy;
    copies.add(copy);
    return copy;
  };
  for (let count = 0; count < edit.rewrites; count++) {
    const entry = changeEntry(pickFrom(random, places));
    const at = pickIndex(random, entry.bullets.length);
    entry.bullets[at] = { ...entry.bullets[at], text: writeSentence(random) };
  }
  if (edit.addsBullet) {
    const added: Bullet = { id: nextBulletId(), text: writeSentence(random), selected: true };
    changeEntry(pickFrom(random, places)).bullets.push(added);
  }
  const roomy = places.filter(({ items, index }) => items[index].bullets.length > 2);
  if (edit.removesBullet && roomy.length) {
    const entry = changeEntry(pickFrom(random, roomy));
    entry.bullets.splice(pickBetween(random, 0, entry.bullets.length - 1), 1);
  }
  return edited;
}
