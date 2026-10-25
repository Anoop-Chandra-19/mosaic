/**
 * Requests that add to the resume, or change it in ways only B1's handles reach, each with
 * the outcomes it accepts and a right answer. Cases 1 to 15 are the spike of 2026-10-22, on
 * the same resume; 26 to 30 move one thing, 31 a whole list. Fictional data only.
 */
import type { SectionKind } from '../../../src/shared/types/resume.ts';
import type { EvalResume } from '../addEvalResume.ts';

/** New text, placed: `after` is the handle before it or "start"; left out, anywhere. */
export interface ExpectedNew {
  into: string;
  after?: string;
  has: string[];
}

export interface ExpectedSection {
  kind: SectionKind;
  labelHas?: string[];
  after?: string;
  lineCount?: number;
  /** Words its lines, or its entry's heading and bullets, hold. */
  has: string[];
}

/** One acceptable end state; anything it leaves out must not change. */
export interface AddOutcome {
  /** Bullets, lines and headings with new text, holding these words. */
  changed?: Record<string, string[]>;
  added?: ExpectedNew[];
  newEntries?: ExpectedNew[];
  newSections?: ExpectedSection[];
  hidden?: string[];
  shown?: string[];
  /** Lists in a new order: "sections", or the section or entry handle. */
  orders?: Record<string, string[]>;
}

export interface AddEvalCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AddCase {
  instruction: string;
  outcomes: AddOutcome[];
  /** A right answer with the one-call tools; `--dry` plays it. */
  answer: AddEvalCall[];
  /** With the builder's tools, where it differs: a section filled after, `propose_move`. */
  builderAnswer?: AddEvalCall[];
}

export const startingAddResume = (): EvalResume => ({
  name: 'Ingrid Vale',
  sections: [
    {
      handle: 's1',
      kind: 'summary',
      layout: 'lines',
      label: 'Summary',
      isShown: true,
      lines: [
        {
          handle: 'l1',
          text: 'Backend engineer with six years in payments and logistics.',
          isShown: true,
        },
      ],
      entries: [],
    },
    {
      handle: 's2',
      kind: 'experience',
      layout: 'entries',
      label: 'Experience',
      isShown: true,
      lines: [],
      entries: [
        {
          handle: 'e1',
          heading: 'Backend Engineer, Harbor Freight Labs · 2021 to 2024',
          isShown: true,
          bullets: [
            { handle: 'b1', text: 'Moved billing from cron jobs to a queue', isShown: true },
            { handle: 'b2', text: 'Reduced p99 latency from 900 ms to 200 ms', isShown: true },
            {
              handle: 'b3',
              text: 'Wrote the on-call runbook for the payments team',
              isShown: true,
            },
          ],
        },
        {
          handle: 'e2',
          heading: 'Intern, Lantern Maps · 2020',
          isShown: true,
          bullets: [
            { handle: 'b4', text: 'Built tile caching for the Oslo office', isShown: true },
          ],
        },
      ],
    },
    {
      handle: 's3',
      kind: 'skills',
      layout: 'lines',
      label: 'Skills',
      isShown: true,
      lines: [
        { handle: 'l2', text: 'Python, Go, Postgres', isShown: true },
        { handle: 'l3', text: 'Docker, Terraform', isShown: true },
      ],
      entries: [],
    },
  ],
});

const add = (args: Record<string, unknown>): AddEvalCall => ({ name: 'propose_add', args });
const rewrite = (id: string, text: string): AddEvalCall => ({
  name: 'propose_rewrite',
  args: { id, text },
});
const section = (args: Record<string, unknown>): AddEvalCall => ({
  name: 'propose_section',
  args,
});
const entry = (args: Record<string, unknown>): AddEvalCall => ({ name: 'propose_entry', args });
const reorder = (args: Record<string, unknown>): AddEvalCall => ({
  name: 'propose_reorder',
  args,
});
const move = (args: Record<string, unknown>): AddEvalCall => ({ name: 'propose_move', args });

export const ADD_CASES: AddCase[] = [
  {
    instruction: 'Add a bullet to Harbor Freight Labs: I led the on-call rotation for a year.',
    outcomes: [{ added: [{ into: 'e1', has: ['on-call'] }] }],
    answer: [add({ into: 'e1', text: 'Led the on-call rotation for a year' })],
  },
  {
    instruction: 'Under Lantern Maps, add that I also wrote the map style guide.',
    outcomes: [{ added: [{ into: 'e2', has: ['style guide'] }] }],
    answer: [add({ into: 'e2', text: 'Wrote the map style guide' })],
  },
  {
    instruction:
      'Add a bullet right after the latency one: I cut cloud costs by 30% by rightsizing databases.',
    outcomes: [{ added: [{ into: 'e1', after: 'b2', has: ['30%'] }] }],
    answer: [
      add({ into: 'e1', after: 'b2', text: 'Cut cloud costs by 30% by rightsizing databases' }),
    ],
  },
  {
    instruction: 'Make the latency bullet say it was for the checkout API.',
    outcomes: [{ changed: { b2: ['checkout'] } }],
    answer: [rewrite('b2', 'Reduced checkout API p99 latency from 900 ms to 200 ms')],
  },
  {
    instruction: 'Add the number of jobs to the billing bullet: there were 40 cron jobs.',
    outcomes: [{ changed: { b1: ['40'] } }],
    answer: [rewrite('b1', 'Moved billing from 40 cron jobs to a queue')],
  },
  {
    instruction: 'Rewrite my summary to mention that I lead on-call.',
    outcomes: [{ changed: { l1: ['on-call'] } }],
    answer: [
      rewrite('l1', 'Backend engineer with six years in payments and logistics, leading on-call.'),
    ],
  },
  {
    instruction: 'Add Kubernetes to my skills.',
    outcomes: [
      { changed: { l2: ['Kubernetes'] } },
      { changed: { l3: ['Kubernetes'] } },
      { added: [{ into: 's3', has: ['Kubernetes'] }] },
    ],
    answer: [rewrite('l3', 'Docker, Terraform, Kubernetes')],
  },
  {
    instruction: 'Add a line to Skills: Spanish and Norwegian.',
    outcomes: [{ added: [{ into: 's3', has: ['Spanish', 'Norwegian'] }] }],
    answer: [add({ into: 's3', text: 'Spanish, Norwegian' })],
  },
  {
    instruction: 'Tighten the runbook bullet.',
    outcomes: [{ changed: { b3: ['runbook'] } }],
    answer: [rewrite('b3', 'Wrote the payments on-call runbook')],
  },
  {
    instruction: 'Add a sentence to my summary saying I mentor junior engineers.',
    outcomes: [{ changed: { l1: ['mentor'] } }, { added: [{ into: 's1', has: ['mentor'] }] }],
    answer: [add({ into: 's1', text: 'I mentor junior engineers.' })],
  },
  {
    instruction:
      'Add two bullets to Lantern Maps: one about writing tests for the tile cache, one about mentoring another intern.',
    outcomes: [
      {
        added: [
          { into: 'e2', has: ['test'] },
          { into: 'e2', has: ['intern'] },
        ],
      },
    ],
    answer: [
      add({ into: 'e2', text: 'Wrote tests for the tile cache' }),
      add({ into: 'e2', text: 'Mentored another intern' }),
    ],
  },
  {
    instruction: 'Replace the runbook bullet with one about leading our incident reviews.',
    outcomes: [{ changed: { b3: ['incident'] } }],
    answer: [rewrite('b3', 'Led the incident reviews for the payments team')],
  },
  {
    instruction:
      "Put a new first bullet under Harbor Freight Labs about running the team's weekly design reviews.",
    outcomes: [{ added: [{ into: 'e1', after: 'start', has: ['design review'] }] }],
    answer: [add({ into: 'e1', after: 'start', text: "Ran the team's weekly design reviews" })],
  },
  {
    instruction: 'Write a new summary that focuses on payments.',
    outcomes: [{ changed: { l1: ['payments'] } }],
    answer: [rewrite('l1', 'Backend engineer focused on payments, with six years in the field.')],
  },
  {
    instruction: 'Add Rust after Go in my skills.',
    outcomes: [{ changed: { l2: ['Go, Rust'] } }],
    answer: [rewrite('l2', 'Python, Go, Rust, Postgres')],
  },
  {
    instruction:
      'Add a Volunteering section with my work at the Riverside Food Bank: I coordinated the weekend delivery drivers.',
    outcomes: [{ newSections: [{ kind: 'volunteering', has: ['Riverside Food Bank', 'driver'] }] }],
    answer: [
      section({
        kind: 'volunteering',
        organization: 'Riverside Food Bank',
        bullets: ['Coordinated the weekend delivery drivers'],
      }),
    ],
    builderAnswer: [
      section({ kind: 'volunteering' }),
      entry({
        sectionId: 's4',
        organization: 'Riverside Food Bank',
        bullets: ['Coordinated the weekend delivery drivers'],
      }),
    ],
  },
  {
    instruction: 'Add a Languages section: Spanish, fluent, and Norwegian, basic.',
    outcomes: [
      { newSections: [{ kind: 'languages', lineCount: 2, has: ['Spanish', 'Norwegian'] }] },
      { newSections: [{ kind: 'languages', lineCount: 1, has: ['Spanish', 'Norwegian'] }] },
    ],
    answer: [section({ kind: 'languages', lines: ['Spanish, fluent', 'Norwegian, basic'] })],
    builderAnswer: [
      section({ kind: 'languages' }),
      add({ into: 's4', text: 'Spanish, fluent' }),
      add({ into: 's4', text: 'Norwegian, basic' }),
    ],
  },
  {
    instruction: 'Rename the Experience heading to Work history.',
    outcomes: [{ changed: { s2: ['Work history'] } }],
    answer: [{ name: 'propose_rename', args: { sectionId: 's2', label: 'Work history' } }],
  },
  {
    instruction: 'Leave the Lantern Maps internship off the page.',
    outcomes: [{ hidden: ['e2'] }],
    answer: [{ name: 'propose_select', args: { id: 'e2', show: false } }],
  },
  {
    instruction: 'Move Skills above Experience.',
    outcomes: [{ orders: { sections: ['s1', 's3', 's2'] } }],
    answer: [reorder({ order: ['s1', 's3', 's2'] })],
    builderAnswer: [move({ id: 's3', before: 's2' })],
  },
  {
    instruction:
      'Add a section called Talks, with one line: Speaker at the Bergen Go meetup, 2024.',
    outcomes: [
      {
        newSections: [{ kind: 'custom', labelHas: ['Talks'], lineCount: 1, has: ['Bergen'] }],
      },
    ],
    answer: [
      section({
        kind: 'custom',
        label: 'Talks',
        lines: ['Speaker at the Bergen Go meetup, 2024'],
      }),
    ],
    builderAnswer: [
      section({ kind: 'custom', label: 'Talks' }),
      add({ into: 's4', text: 'Speaker at the Bergen Go meetup, 2024' }),
    ],
  },
  {
    instruction: 'Add a Skills section with Figma.',
    outcomes: [
      { added: [{ into: 's3', has: ['Figma'] }] },
      { changed: { l2: ['Figma'] } },
      { changed: { l3: ['Figma'] } },
    ],
    answer: [add({ into: 's3', text: 'Figma' })],
  },
  {
    instruction:
      'Add a Certifications section at the very top: AWS Solutions Architect Associate, 2023.',
    outcomes: [{ newSections: [{ kind: 'certifications', after: 'start', has: ['AWS'] }] }],
    answer: [
      section({
        kind: 'certifications',
        after: 'start',
        title: 'AWS Solutions Architect Associate',
        dates: '2023',
      }),
    ],
    builderAnswer: [
      section({ kind: 'certifications', after: 'start' }),
      entry({ sectionId: 's4', title: 'AWS Solutions Architect Associate', dates: '2023' }),
    ],
  },
  {
    instruction:
      'Add a Projects section after Skills with Tidewatch, a tide chart app I built in Kotlin.',
    outcomes: [{ newSections: [{ kind: 'projects', after: 's3', has: ['Tidewatch', 'Kotlin'] }] }],
    answer: [
      section({
        kind: 'projects',
        after: 's3',
        title: 'Tidewatch',
        bullets: ['Built a tide chart app in Kotlin'],
      }),
    ],
    builderAnswer: [
      section({ kind: 'projects', after: 's3' }),
      entry({ sectionId: 's4', title: 'Tidewatch', bullets: ['Built a tide chart app in Kotlin'] }),
    ],
  },
  {
    instruction: 'Take the Docker, Terraform line off the page.',
    outcomes: [{ hidden: ['l3'] }],
    answer: [{ name: 'propose_select', args: { id: 'l3', show: false } }],
  },
  {
    instruction: 'Move the runbook bullet to the top of Harbor Freight Labs.',
    outcomes: [{ orders: { e1: ['b3', 'b1', 'b2'] } }],
    answer: [reorder({ sectionId: 's2', entryId: 'e1', order: ['b3', 'b1', 'b2'] })],
    builderAnswer: [move({ id: 'b3', after: 'start' })],
  },
  {
    instruction: 'Put the Summary at the bottom.',
    outcomes: [{ orders: { sections: ['s2', 's3', 's1'] } }],
    answer: [reorder({ order: ['s2', 's3', 's1'] })],
    builderAnswer: [move({ id: 's1', after: 's3' })],
  },
  {
    instruction: 'Swap the two Skills lines.',
    outcomes: [{ orders: { s3: ['l3', 'l2'] } }],
    answer: [reorder({ sectionId: 's3', order: ['l3', 'l2'] })],
    builderAnswer: [move({ id: 'l3', before: 'l2' })],
  },
  {
    instruction: 'Move the latency bullet below the runbook one.',
    outcomes: [{ orders: { e1: ['b1', 'b3', 'b2'] } }],
    answer: [reorder({ sectionId: 's2', entryId: 'e1', order: ['b1', 'b3', 'b2'] })],
    builderAnswer: [move({ id: 'b2', after: 'b3' })],
  },
  {
    instruction: 'Put Lantern Maps above Harbor Freight Labs.',
    outcomes: [{ orders: { s2: ['e2', 'e1'] } }],
    answer: [reorder({ sectionId: 's2', order: ['e2', 'e1'] })],
    builderAnswer: [move({ id: 'e2', before: 'e1' })],
  },
  {
    instruction: 'Put my Harbor Freight bullets in this order: latency, runbook, billing.',
    outcomes: [{ orders: { e1: ['b2', 'b3', 'b1'] } }],
    answer: [reorder({ sectionId: 's2', entryId: 'e1', order: ['b2', 'b3', 'b1'] })],
    builderAnswer: [reorder({ order: ['b2', 'b3', 'b1'] })],
  },
];
