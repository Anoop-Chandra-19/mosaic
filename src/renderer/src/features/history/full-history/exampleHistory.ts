import { DAY, startOfDay } from '@shared/time/calendar';
import { DEFAULT_RESUME } from '@shared/resume/defaultResume';
import type { Version, VersionKind, VersionMeta, VersionSource } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';

/*
 * The history the history tour shows: a fictional person's month of work, with every kind
 * of row in it, so the tour never depends on what someone's own history holds. It is only
 * ever held in memory and read; nothing here is written anywhere.
 */

export const EXAMPLE_TEMPLATE_ID = 'example-history';
export const EXAMPLE_TEMPLATE_NAME = 'Senior SWE, Striped';
/** The tour opens on a sitting's last revision, the one kept just before an apply. */
export const EXAMPLE_OPENING_ID = 'example-v11.3';

/** The bullets as each version had them, oldest first: each step changes the last. */
const BULLETS: readonly (readonly string[])[] = [
  [
    'Moved dispatch routing onto a streaming pipeline for ops.',
    'Helped with the move off the legacy scheduler.',
    'Built the carrier API.',
  ],
  [
    'Moved dispatch routing onto a streaming pipeline for the ops team.',
    'Helped with the move off the legacy scheduler.',
    'Built the carrier API used by partners.',
  ],
  [
    'Cut dispatch latency by moving routing onto a streaming pipeline for the ops team.',
    'Helped with the move off the legacy scheduler.',
    'Built the carrier API used by partners.',
  ],
  [
    'Cut dispatch latency by moving routing onto a streaming pipeline for the ops team.',
    'Led a team of four through the move off the legacy scheduler.',
    'Built the carrier API used by partners.',
  ],
  [
    'Cut dispatch latency by moving routing onto a streaming pipeline for the ops team.',
    'Led a team of four through the move off the legacy scheduler.',
    'Built the carrier API used by 31 partners.',
  ],
  [
    'Cut dispatch latency by 38% by moving routing onto a streaming pipeline.',
    'Led a team of four through the move off the legacy scheduler.',
    'Built the carrier API used by 31 partners.',
  ],
  [
    'Cut dispatch latency by 38% by moving routing onto a streaming pipeline.',
    'Led a team of four through the move off the legacy scheduler.',
    'Built the carrier API used by 40 partners.',
  ],
  [
    'Cut dispatch latency by 38% by moving routing onto a streaming pipeline.',
    'Led four engineers through the move off the legacy scheduler.',
    'Built the carrier API used by 40 partners.',
  ],
];

interface ExampleRow {
  label: string;
  kind?: VersionKind;
  source: VersionSource;
  summary: string;
  /** Days back from today, and the time that day. */
  daysAgo: number;
  at: [hour: number, minute: number];
  /** Which of `BULLETS` its page has. */
  stage: number;
}

/** Newest first, as the list reads. */
const ROWS: readonly ExampleRow[] = [
  {
    label: 'v14',
    source: 'edit',
    summary: 'Edited Experience',
    daysAgo: 1,
    at: [14, 20],
    stage: 7,
  },
  {
    label: 'v13',
    kind: 'named',
    source: 'name',
    summary: 'Sent to Northwind',
    daysAgo: 1,
    at: [9, 50],
    stage: 6,
  },
  {
    label: 'v12.1',
    source: 'assistant',
    summary: 'Applied 5 of 6 suggestions',
    daysAgo: 1,
    at: [9, 44],
    stage: 6,
  },
  {
    label: 'v12',
    source: 'assistant',
    summary: 'Applied 4 of 6 suggestions',
    daysAgo: 1,
    at: [9, 41],
    stage: 5,
  },
  {
    label: 'v11.3',
    source: 'before-apply',
    summary: 'Before applying suggestions',
    daysAgo: 1,
    at: [9, 40],
    stage: 4,
  },
  {
    label: 'v11.2',
    source: 'edit',
    summary: 'Edited Experience',
    daysAgo: 1,
    at: [9, 31],
    stage: 3,
  },
  {
    label: 'v11.1',
    source: 'edit',
    summary: 'Edited Experience',
    daysAgo: 1,
    at: [9, 15],
    stage: 2,
  },
  { label: 'v11', source: 'edit', summary: 'Edited Experience', daysAgo: 1, at: [9, 2], stage: 2 },
  {
    label: 'v10',
    kind: 'named',
    source: 'name',
    summary: 'Sent to Vela',
    daysAgo: 2,
    at: [17, 5],
    stage: 1,
  },
  {
    label: 'v9',
    source: 'closed',
    summary: 'Where you left it',
    daysAgo: 4,
    at: [18, 2],
    stage: 1,
  },
  {
    label: 'v8',
    source: 'before-restore',
    summary: 'Before restoring v5',
    daysAgo: 4,
    at: [16, 10],
    stage: 1,
  },
  {
    label: 'v7',
    kind: 'named',
    source: 'name',
    summary: 'Sent to Kestrel',
    daysAgo: 35,
    at: [11, 0],
    stage: 0,
  },
  { label: 'v6', source: 'edit', summary: 'Edited Projects', daysAgo: 39, at: [15, 30], stage: 0 },
  {
    label: 'v5',
    source: 'edit',
    summary: 'Edited Experience',
    daysAgo: 41,
    at: [12, 10],
    stage: 0,
  },
  { label: 'v4', source: 'edit', summary: 'Edited Skills', daysAgo: 42, at: [10, 5], stage: 0 },
  {
    label: 'v3',
    kind: 'named',
    source: 'name',
    summary: 'First full draft',
    daysAgo: 46,
    at: [18, 0],
    stage: 0,
  },
  {
    label: 'v2',
    source: 'edit',
    summary: 'Edited Experience',
    daysAgo: 47,
    at: [15, 40],
    stage: 0,
  },
  {
    label: 'v1',
    source: 'import',
    summary: 'Imported resume-2026.pdf',
    daysAgo: 47,
    at: [15, 12],
    stage: 0,
  },
];

/** The fictional resume, with its experience bullets as `bullets` has them. */
function buildExampleResume(bullets: readonly string[]): ResumeData {
  const resume = structuredClone(DEFAULT_RESUME);
  resume.contact.name = 'Rowan Vale';
  const experience = resume.sections.find((section) => section.kind === 'experience')!;
  experience.items = [
    {
      id: 'example-harbor',
      selected: true,
      title: 'Senior Software Engineer',
      organization: 'Harbor Freight Labs',
      location: 'Seattle, WA',
      dates: '2022 to now',
      bullets: bullets.map((text, index) => ({ id: `example-b${index}`, selected: true, text })),
    },
  ];
  return resume;
}

function parseLabel(label: string): { number: number; revision: number } {
  const [number, revision = '0'] = label.slice(1).split('.');
  return { number: Number(number), revision: Number(revision) };
}

export interface ExampleHistory {
  /** Newest first. */
  versions: VersionMeta[];
  readVersion: (id: string) => Version;
  /** The draft the example stands for: its newest version, as an untouched draft would be. */
  draft: ResumeData;
}

/** The example, dated from today so it reads as recent. */
export function buildExampleHistory(now: number = Date.now()): ExampleHistory {
  const today = startOfDay(now);
  const pages = BULLETS.map(buildExampleResume);
  const versions = ROWS.map((row, index): VersionMeta => {
    const day = new Date(today - row.daysAgo * DAY);
    day.setHours(row.at[0], row.at[1]);
    return {
      id: `example-${row.label}`,
      templateId: EXAMPLE_TEMPLATE_ID,
      ...parseLabel(row.label),
      parentId: ROWS[index + 1] ? `example-${ROWS[index + 1].label}` : null,
      kind: row.kind ?? 'auto',
      source: row.source,
      summary: row.summary,
      section: row.source === 'edit' ? 'Experience' : null,
      rev: ROWS.length - index,
      createdAt: day.getTime(),
    };
  });
  const stageOf = new Map(versions.map((version, index) => [version.id, ROWS[index].stage]));
  return {
    versions,
    readVersion: (id) => {
      const version = versions.find((candidate) => candidate.id === id);
      if (!version) throw new Error(`No example version ${id}`);
      return { ...version, doc: pages[stageOf.get(id)!] };
    },
    draft: pages[ROWS[0].stage],
  };
}
