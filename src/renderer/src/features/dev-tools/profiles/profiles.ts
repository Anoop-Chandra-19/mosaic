import { parseResumeText } from '@/features/import/parsing/parseResume';
import { CURRENT_SCHEMA_VERSION } from '@shared/resume/migrateResume';
import { HOUR, MINUTE } from '@shared/time/calendar';
import type { BundleTemplate } from '@shared/types/bundle';
import type { ResumeData } from '@shared/types/resume';
import { createExampleResume } from '../tools/exampleResume';
import { buildTemplateHistory, type PlannedVersion } from './buildTemplateHistory';
import { editResume } from './editResume';
import { createSeededRandom, pickBetween, type SeededRandom } from './seededRandom';
import { worstCaseResumeText } from './worstCaseResume';

/*
 * Whole sets of development data, made up from a fixed seed so each is the same every time:
 * Fresh is none at all, Everyday what a few weeks of use leave, Heavy a long history on the
 * worst-case resume, and Worst case the most the app should ever hold, which the speed check
 * runs on. Each but Fresh is generated here a template at a time, as a backup holds it, for
 * `loadProfile.ts` to restore.
 */

export const PROFILE_NAMES = ['Fresh', 'Everyday', 'Heavy', 'Worst case'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];
export type GeneratedProfileName = Exclude<ProfileName, 'Fresh'>;

interface Profile {
  /** Beside its name in the palette. */
  holds: string;
  /** What replacing the data with it leaves, for the confirm. */
  leaves: string;
}

export const PROFILES: Record<ProfileName, Profile> = {
  Fresh: {
    holds: 'nothing, as on first run',
    leaves:
      'Leaves it empty, as on first run: settings, conversations and the development keychain’s API keys go too, as with dev:reset.',
  },
  Everyday: {
    holds: '3 templates, about 40 versions each',
    leaves:
      'Writes 3 generated templates, about 40 versions each. Settings and conversations stay.',
  },
  Heavy: {
    holds: '12 templates, 600 versions, a 210-bullet resume',
    leaves:
      'Writes 12 generated templates, with 600 versions on Tailored for Kestrel, the 210-bullet resume. Takes a second or so and can’t be stopped halfway; the window stays usable.',
  },
  'Worst case': {
    holds: '50 templates, 3,000 versions, 210 bullets in each',
    leaves:
      'Writes 50 generated templates of the 210-bullet resume, 3,000 versions on Tailored for Kestrel and 60 on each other. Written in parts, so a failure partway leaves the parts written. The window stays usable.',
  },
};

interface TemplateShape {
  name: string;
  /** The resume its first version holds. */
  start: 'example' | 'worstCase';
  versions: number;
}

const HEAVY_OTHERS: [string, number][] = [
  ['Base resume', 48],
  ['Harbor Freight Labs', 37],
  ['Product roles, long', 21],
  ['Lantern Geo', 30],
  ['Halden Works', 12],
  ['Marlow Systems', 44],
  ['Cedar Analytics', 9],
  ['Brightwater Labs', 25],
  ['Quill and Ledger', 16],
  ['Fernhill Robotics', 33],
  ['One page, short', 5],
];

const WORST_CASE_OTHERS = Array.from({ length: 49 }, (_, index): TemplateShape => ({
  name: `Tailored for company ${index + 1}`,
  start: 'worstCase',
  versions: 60,
}));

/** The first is the one left open. */
const PROFILE_TEMPLATES: Record<GeneratedProfileName, TemplateShape[]> = {
  Everyday: [
    { name: 'Base resume', start: 'example', versions: 48 },
    { name: 'Tailored for Kestrel', start: 'example', versions: 40 },
    { name: 'Harbor Freight Labs', start: 'example', versions: 37 },
  ],
  Heavy: [
    { name: 'Tailored for Kestrel', start: 'worstCase', versions: 600 },
    ...HEAVY_OTHERS.map(([name, versions]): TemplateShape => ({
      name,
      start: 'example',
      versions,
    })),
  ],
  'Worst case': [
    { name: 'Tailored for Kestrel', start: 'worstCase', versions: 3000 },
    ...WORST_CASE_OTHERS,
  ],
};

const SEEDS: Record<GeneratedProfileName, number> = { Everyday: 1, Heavy: 2, 'Worst case': 3 };

const VERSION_NAMES = [
  'First full draft',
  'Sent to Kestrel',
  'Before the cover letter',
  'After the recruiter call',
  'Trimmed to one page',
  'Sent to Halden Works',
  'Spring refresh',
  'Two pages, all roles',
];

/** Versions report back this often, letting the window draw. */
const VERSIONS_PER_REPORT = 20;

/** Ids by place, so the same profile has the same ids: `t1-s2-e3-b4`. */
function numberResumeIds(doc: ResumeData, prefix: string): ResumeData {
  return {
    ...doc,
    contact: {
      ...doc.contact,
      header: {
        ...doc.contact.header,
        lines: doc.contact.header.lines.map((line, l) => ({
          ...line,
          id: `${prefix}-h${l + 1}`,
          items: line.items.map((item, i) => ({ ...item, id: `${prefix}-h${l + 1}-${i + 1}` })),
        })),
      },
    },
    sections: doc.sections.map((section, s) => ({
      ...section,
      id: `${prefix}-s${s + 1}`,
      items: section.items.map((entry, e) => ({
        ...entry,
        id: `${prefix}-s${s + 1}-e${e + 1}`,
        bullets: entry.bullets.map((bullet, b) => ({
          ...bullet,
          id: `${prefix}-s${s + 1}-e${e + 1}-b${b + 1}`,
        })),
      })),
    })),
  };
}

/** The worst case through the importer, as the speed check pastes it. */
function readWorstCaseResume(): ResumeData {
  const { contact, sections } = parseResumeText(worstCaseResumeText()).resume;
  return { schemaVersion: CURRENT_SCHEMA_VERSION, contact, sections };
}

const START_RESUMES: Record<TemplateShape['start'], () => ResumeData> = {
  example: createExampleResume,
  worstCase: readWorstCaseResume,
};

/**
 * A history as editing leaves one: a few bullets reworded each time, now and then one added
 * or dropped, some edits kept as revisions of one session, about one in ten named. Hours or
 * days apart, the newest an hour before `now`.
 */
function planVersions(
  shape: TemplateShape,
  templateId: string,
  random: SeededRandom,
  now: number
): PlannedVersion[] {
  let doc = numberResumeIds(START_RESUMES[shape.start](), templateId);
  let addedBullets = 0;
  const nextBulletId = () => `${templateId}-added${++addedBullets}`;
  const planned: Omit<PlannedVersion, 'takenAt'>[] = [{ doc }];
  const gaps = [0];
  for (let round = 1; round < shape.versions; round++) {
    doc = editResume(
      doc,
      {
        rewrites: pickBetween(random, 1, 3),
        addsBullet: random() < 0.1,
        removesBullet: random() < 0.08,
      },
      random,
      nextBulletId
    );
    const isNamed = random() < 0.1;
    const isRevision = !isNamed && random() < 0.3;
    planned.push({
      doc,
      name: isNamed ? VERSION_NAMES[pickBetween(random, 0, VERSION_NAMES.length - 1)] : undefined,
      isRevision,
    });
    gaps.push(isRevision ? pickBetween(random, 5, 25) * MINUTE : pickBetween(random, 2, 40) * HOUR);
  }
  const span = gaps.reduce((sum, gap) => sum + gap, 0);
  let takenAt = now - HOUR - span;
  return planned.map((version, index) => {
    takenAt += gaps[index];
    return { ...version, takenAt };
  });
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

/** Every version a profile holds, for how far along it is. */
export function countProfileVersions(name: GeneratedProfileName): number {
  return PROFILE_TEMPLATES[name].reduce((sum, shape) => sum + shape.versions, 0);
}

/**
 * The profile's templates as a backup holds them, one at a time, so a large profile is never
 * held whole; the same for the same `now`. `onProgress` hears how many versions are made, now
 * and then while it works.
 */
export async function* generateProfileTemplates(
  name: GeneratedProfileName,
  now: number,
  onProgress?: (versionsMade: number) => void
): AsyncGenerator<BundleTemplate> {
  const random = createSeededRandom(SEEDS[name]);
  let made = 0;
  const afterEach = async () => {
    made++;
    if (made % VERSIONS_PER_REPORT > 0) return;
    onProgress?.(made);
    await nextTask();
  };
  for (const [index, shape] of PROFILE_TEMPLATES[name].entries()) {
    const id = `${name.toLowerCase().replace(' ', '-')}-t${index + 1}`;
    const versions = planVersions(shape, id, random, now);
    yield await buildTemplateHistory({ id, name: shape.name, versions }, afterEach);
  }
}
