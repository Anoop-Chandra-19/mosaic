import type { StagedChange } from '@/features/agent/proposals/proposalActions';
import type { ProposalChange } from '@shared/types/agentProposal';
import { createExampleResume, EXAMPLE_IDS } from './exampleResume';

export const EXAMPLE_REQUEST =
  'Tighten my experience bullets, put the AWS work first, and add my Code for Portland volunteering.';

const { experience: sectionId, harbor, lantern } = EXAMPLE_IDS;

/** The example's bullet text, so each change is anchored to exactly what the draft holds. */
function textOf(bulletId: string): string {
  for (const entry of createExampleResume().sections.flatMap((section) => section.items)) {
    const found = entry.bullets.find((bullet) => bullet.id === bulletId);
    if (found) return found.text;
  }
  throw new Error(`The example resume has no bullet ${bulletId}`);
}

function rewrite(
  entryId: string,
  bulletId: string,
  after: string,
  withoutNumber?: string
): ProposalChange {
  return {
    kind: 'rewrite',
    sectionId,
    entryId,
    bulletId,
    before: textOf(bulletId),
    after,
    ...(withoutNumber && { gap: { withoutNumber } }),
  };
}

const splitAt = (bulletId: string, before: string): ProposalChange => {
  const text = textOf(bulletId);
  return {
    kind: 'split',
    sectionId,
    entryId: lantern,
    bulletId,
    before: text,
    at: text.indexOf(before),
  };
};

/**
 * Every kind of suggestion and every check, staged on the example resume. Two rewrites of
 * one bullet, and a split of a bullet another suggestion rewrites, show what Apply skips.
 * A function, so a release build can leave it out.
 */
export const createExampleSuggestions = (): StagedChange[] => [
  {
    source: 'rewrite',
    reason: 'Starts on the verb and drops the filler.',
    change: rewrite(harbor, 'ex-b1', 'Led the billing migration to Postgres'),
  },
  {
    source: 'rewrite',
    reason: 'Shorter; the percentages already say what was measured.',
    change: rewrite(harbor, 'ex-b2', 'Reduced reduce p99 latency from 18% to 3%'),
  },
  {
    source: 'rewrite',
    reason: 'An outcome reads stronger than an audience, if you have the number.',
    change: rewrite(
      harbor,
      'ex-b3',
      'Wrote the on-call runbook that cut pages by {{?}}%',
      'Wrote the on-call runbook that cut pages for payments'
    ),
  },
  {
    source: 'select',
    reason: 'Not experience a backend role screens for. It stays in your content.',
    change: {
      kind: 'select',
      sectionId,
      entryId: harbor,
      bulletId: 'ex-b4',
      before: textOf('ex-b4'),
      selected: false,
    },
  },
  {
    source: 'rewrite',
    reason: 'Names every office the cache served.',
    change: rewrite(lantern, 'ex-b5', 'Built tile caching for the Oslo and Bergen offices'),
  },
  {
    source: 'split',
    reason: 'Two pieces of work; each reads better on its own line.',
    change: splitAt('ex-b6', 'Wrote the capacity plan'),
  },
  {
    source: 'rewrite',
    reason: 'Plainer for a reader who isn’t a specialist.',
    change: rewrite(
      lantern,
      'ex-b6',
      'Moved tile rendering to the cloud. Wrote the capacity plan for the move.'
    ),
  },
  {
    source: 'merge',
    reason: 'One story: the guide, then what it was for.',
    change: {
      kind: 'merge',
      sectionId,
      entryId: lantern,
      firstId: 'ex-b7',
      secondId: 'ex-b8',
      before: [textOf('ex-b7'), textOf('ex-b8')],
      after: 'Wrote the on-call guide for routing and used it to train four new engineers',
    },
  },
  {
    source: 'reorder',
    reason: 'You asked for the AWS work first.',
    change: {
      kind: 'reorder',
      sectionId,
      entryId: lantern,
      before: ['ex-b5', 'ex-b6', 'ex-b7', 'ex-b8', 'ex-b9'],
      after: ['ex-b6', 'ex-b5', 'ex-b7', 'ex-b8', 'ex-b9'],
    },
  },
  {
    source: 'rewrite',
    reason: 'A number makes the result concrete.',
    change: rewrite(lantern, 'ex-b9', 'Cut deploy time for the routing service by 40%'),
  },
  {
    source: 'rewrite',
    reason: 'Leads with the size of the change.',
    change: rewrite(harbor, 'ex-b2', 'Cut slow requests by 83%, from 18% to 3% of traffic'),
  },
  {
    source: 'entry',
    reason: 'You asked for it. The title and dates are guesses, so they need you.',
    change: {
      kind: 'entry',
      sectionId,
      afterEntryId: lantern,
      frame: {
        title: 'Volunteer Mentor',
        organization: 'Code for Portland',
        location: 'Portland, OR',
        dates: '2021 – Present',
      },
      bullets: ['Mentor first-time contributors on civic data projects'],
    },
  },
];
