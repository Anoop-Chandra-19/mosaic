import type { Bullet, ResumeData, ResumeEntry } from '@shared/types/resume';
import { pickBetween, pickFrom, type SeededRandom } from './seededRandom';

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

const entriesWithBullets = (doc: ResumeData): ResumeEntry[] =>
  doc.sections.flatMap((section) => section.items).filter((entry) => entry.bullets.length > 0);

/** A changed copy: `doc` is left as it was, since versions keep the documents they hold. */
export function editResume(
  doc: ResumeData,
  edit: ResumeEdit,
  random: SeededRandom,
  nextBulletId: () => string
): ResumeData {
  const edited = structuredClone(doc);
  if (edit.contactName !== undefined) edited.contact.name = edit.contactName;
  const entries = entriesWithBullets(edited);
  if (entries.length === 0) return edited;
  for (let count = 0; count < edit.rewrites; count++) {
    const bullet = pickFrom(random, pickFrom(random, entries).bullets);
    bullet.text = writeSentence(random);
  }
  if (edit.addsBullet) {
    const added: Bullet = { id: nextBulletId(), text: writeSentence(random), selected: true };
    pickFrom(random, entries).bullets.push(added);
  }
  const roomy = entries.filter((entry) => entry.bullets.length > 2);
  if (edit.removesBullet && roomy.length) {
    const entry = pickFrom(random, roomy);
    entry.bullets.splice(pickBetween(random, 0, entry.bullets.length - 1), 1);
  }
  return edited;
}
