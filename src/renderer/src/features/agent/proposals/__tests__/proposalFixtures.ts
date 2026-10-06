import type { Proposal, ProposalChange } from '@shared/types/agent';
import { createEmptyResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';

/** A fictional resume with fixed ids: one experience entry of three bullets, and a second entry. */
export function makeResume(): ResumeData {
  const doc = createEmptyResume();
  doc.contact.name = 'Rowan Vale';
  doc.sections = [
    {
      id: 's1',
      kind: 'experience',
      layout: 'entries',
      label: 'Experience',
      order: 0,
      items: [
        {
          id: 'e1',
          selected: true,
          title: 'Backend Engineer',
          organization: 'Harbor Freight Labs',
          dates: '2021 – 2024',
          bullets: [
            { id: 'b1', text: 'Assisted in migrating billing to Postgres', selected: true },
            { id: 'b2', text: 'Reduced p99 latency from 18% to 3% of requests', selected: true },
            { id: 'b3', text: 'Wrote the on-call runbook for the payments team', selected: true },
          ],
        },
        {
          id: 'e2',
          selected: true,
          title: 'Intern',
          organization: 'Lantern Maps',
          bullets: [{ id: 'b4', text: 'Built tile caching for the Oslo office', selected: true }],
        },
      ],
    },
  ];
  return doc;
}

export function rewrite(
  bulletId: string,
  before: string,
  after: string
): Extract<ProposalChange, { kind: 'rewrite' }> {
  return { kind: 'rewrite', sectionId: 's1', entryId: 'e1', bulletId, before, after };
}

/** A proposal as staging would make it, for tests that start past staging. */
export function makeProposal(change: ProposalChange, id: string): Proposal {
  return {
    id,
    templateId: 't1',
    source: change.kind,
    change,
    status: 'accepted',
    isStale: false,
    flags: [],
    requestText: '',
    createdAt: 0,
  };
}
