/**
 * Held-out cases for the add eval: another resume, and requests worded unlike the main
 * set's, written on 2026-10-24 before any tuning against the eval. The manifest is tuned
 * on the main set only; a gain there that doesn't show here means the tuning fit the test.
 * Never change a case to fit a result: one that looks wrong is discussed first. Fictional
 * data only.
 */
import type { EvalResume } from '../addEvalResume.ts';
import type { AddCase, AddEvalCall } from './addCases.ts';

export const startingHeldOutResume = (): EvalResume => ({
  name: 'Leila Brandt',
  sections: [
    {
      handle: 's1',
      kind: 'summary',
      layout: 'lines',
      label: 'Profile',
      isShown: true,
      lines: [
        {
          handle: 'l1',
          text: 'Product designer with seven years in web and print.',
          isShown: true,
        },
      ],
      entries: [],
    },
    {
      handle: 's2',
      kind: 'experience',
      layout: 'entries',
      label: 'Work',
      isShown: true,
      lines: [],
      entries: [
        {
          handle: 'e1',
          heading: 'Product Designer, Kestrel Studio · 2019 to 2024',
          isShown: true,
          bullets: [
            {
              handle: 'b1',
              text: 'Designed the booking flow for a chain of climbing gyms',
              isShown: true,
            },
            {
              handle: 'b2',
              text: "Built and kept up the studio's component library in Figma",
              isShown: true,
            },
            {
              handle: 'b3',
              text: 'Ran usability tests with 40 customers each quarter',
              isShown: true,
            },
          ],
        },
        {
          handle: 'e2',
          heading: 'Junior Designer, Pinegrove Press · 2017 to 2019',
          isShown: true,
          bullets: [
            { handle: 'b4', text: 'Laid out the spring and autumn catalogues', isShown: true },
            { handle: 'b5', text: 'Prepared print files for the bindery', isShown: true },
          ],
        },
      ],
    },
    {
      handle: 's3',
      kind: 'education',
      layout: 'entries',
      label: 'Education',
      isShown: true,
      lines: [],
      entries: [
        {
          handle: 'e3',
          heading: 'BA Graphic Design, Hallam School of Art · 2017',
          isShown: true,
          bullets: [],
        },
      ],
    },
    {
      handle: 's4',
      kind: 'skills',
      layout: 'lines',
      label: 'Tools',
      isShown: true,
      lines: [
        { handle: 'l2', text: 'Figma, Sketch, Illustrator', isShown: true },
        { handle: 'l3', text: 'HTML, CSS', isShown: true },
      ],
      entries: [],
    },
  ],
});

const call = (name: string, args: Record<string, unknown>): AddEvalCall => ({ name, args });

export const HELD_OUT_CASES: AddCase[] = [
  {
    instruction: 'Under Kestrel Studio, mention that I ran the client workshops.',
    outcomes: [{ added: [{ into: 'e1', has: ['workshop'] }] }],
    answer: [call('propose_add', { into: 'e1', text: 'Ran the client workshops' })],
  },
  {
    instruction: 'Stick Tailwind onto the end of my HTML, CSS line.',
    outcomes: [{ changed: { l3: ['Tailwind'] } }],
    answer: [call('propose_rewrite', { id: 'l3', text: 'HTML, CSS, Tailwind' })],
  },
  {
    instruction:
      "I'd like an Awards section: the Typography Prize from Hallam School of Art, 2016.",
    outcomes: [{ newSections: [{ kind: 'awards', has: ['Typography Prize'] }] }],
    answer: [
      call('propose_section', {
        kind: 'awards',
        title: 'Typography Prize',
        organization: 'Hallam School of Art',
        dates: '2016',
      }),
    ],
    builderAnswer: [
      call('propose_section', { kind: 'awards' }),
      call('propose_entry', {
        sectionId: 's5',
        title: 'Typography Prize',
        organization: 'Hallam School of Art',
        dates: '2016',
      }),
    ],
  },
  {
    instruction: 'Drop Pinegrove Press from the printed page.',
    outcomes: [{ hidden: ['e2'] }],
    answer: [call('propose_select', { id: 'e2', show: false })],
  },
  {
    instruction: 'Education should come before Work.',
    outcomes: [{ orders: { sections: ['s1', 's3', 's2', 's4'] } }],
    answer: [call('propose_reorder', { order: ['s1', 's3', 's2', 's4'] })],
    builderAnswer: [call('propose_move', { id: 's3', before: 's2' })],
  },
  {
    instruction: 'Make the second Pinegrove bullet the first one.',
    outcomes: [{ orders: { e2: ['b5', 'b4'] } }],
    answer: [call('propose_reorder', { sectionId: 's2', entryId: 'e2', order: ['b5', 'b4'] })],
    builderAnswer: [call('propose_move', { id: 'b5', after: 'start' })],
  },
  {
    instruction: 'Call the Tools section Software instead.',
    outcomes: [{ changed: { s4: ['Software'] } }],
    answer: [call('propose_rename', { sectionId: 's4', label: 'Software' })],
  },
  {
    instruction: 'Add an Interests section listing bouldering and letterpress printing.',
    outcomes: [{ newSections: [{ kind: 'interests', has: ['bouldering', 'letterpress'] }] }],
    answer: [
      call('propose_section', { kind: 'interests', lines: ['Bouldering, letterpress printing'] }),
    ],
    builderAnswer: [
      call('propose_section', { kind: 'interests' }),
      call('propose_add', { into: 's5', text: 'Bouldering, letterpress printing' }),
    ],
  },
  {
    instruction:
      'Put a new opening bullet on the Kestrel job: I led the rebrand for three clients.',
    outcomes: [{ added: [{ into: 'e1', after: 'start', has: ['rebrand'] }] }],
    answer: [
      call('propose_add', {
        into: 'e1',
        after: 'start',
        text: 'Led the rebrand for three clients',
      }),
    ],
  },
  {
    instruction: 'Reverse the order of my Kestrel bullets.',
    outcomes: [{ orders: { e1: ['b3', 'b2', 'b1'] } }],
    answer: [
      call('propose_reorder', { sectionId: 's2', entryId: 'e1', order: ['b3', 'b2', 'b1'] }),
    ],
    builderAnswer: [call('propose_reorder', { order: ['b3', 'b2', 'b1'] })],
  },
  {
    instruction:
      'Add a freelance job to Work: Freelance Designer, 2024 to now, designing book covers.',
    outcomes: [{ newEntries: [{ into: 's2', has: ['Freelance', 'cover'] }] }],
    answer: [
      call('propose_entry', {
        sectionId: 's2',
        title: 'Freelance Designer',
        dates: '2024 to now',
        bullets: ['Designed book covers'],
      }),
    ],
  },
  {
    instruction: 'Mention Procreate in my tools.',
    outcomes: [
      { changed: { l2: ['Procreate'] } },
      { changed: { l3: ['Procreate'] } },
      { added: [{ into: 's4', has: ['Procreate'] }] },
    ],
    answer: [call('propose_rewrite', { id: 'l2', text: 'Figma, Sketch, Illustrator, Procreate' })],
  },
];
