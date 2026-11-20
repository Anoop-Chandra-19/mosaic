import type { Proposal, ProposalChange, ProposalVersion } from '@/types/agentProposal';
import { createEmptyResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import { createNewContentIds } from '../newContentIds';
import { resolveProposal, type ReviewedChange } from '../reviewedChange';

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

/** The fixture resume with a Summary and a Skills section, whose items are lines. */
export function makeResumeWithLines(): ResumeData {
  const doc = makeResume();
  doc.sections.push(
    {
      id: 's2',
      kind: 'summary',
      layout: 'lines',
      label: 'Summary',
      order: 1,
      items: [{ id: 'l1', selected: true, bullets: [], text: 'Backend engineer for six years.' }],
    },
    {
      id: 's3',
      kind: 'skills',
      layout: 'lines',
      label: 'Skills',
      order: 2,
      items: [
        { id: 'l2', selected: true, bullets: [], text: 'Go, Python, Postgres' },
        { id: 'l3', selected: true, bullets: [], text: 'Docker, Terraform' },
      ],
    }
  );
  return doc;
}

/** New text after `afterId` (null: first), in entry e1 or, for a line, in Skills. */
export function addText(
  unit: 'bullet' | 'line',
  afterId: string | null,
  text: string
): Extract<ProposalChange, { kind: 'add' }> {
  const place =
    unit === 'bullet' ? { unit, sectionId: 's1', entryId: 'e1' } : { unit, sectionId: 's3' };
  return { kind: 'add', place, afterId, text };
}

export function rewrite(
  bulletId: string,
  before: string,
  after: string
): Extract<ProposalChange, { kind: 'rewrite' }> {
  return {
    kind: 'rewrite',
    place: { unit: 'bullet', sectionId: 's1', entryId: 'e1', bulletId },
    before,
    after,
  };
}

/**
 * Build a kept proposal with one version, the way staging does, for tests that start after
 * staging. Ids for what it adds come from its own id: `p1-new1`, `p1-new2`, in
 * `listNewContentIds` order. Its version's id is `p1-v1`. `version` sets the version's own
 * fields, such as the user's review or the flags.
 */
export function makeProposal(
  change: ProposalChange,
  id: string,
  version: Partial<ProposalVersion> = {}
): Proposal {
  let generatedIdCount = 0;
  const versionId = `${id}-v1`;
  return {
    id,
    templateId: 't1',
    source: change.kind,
    versions: [
      {
        id: versionId,
        change,
        newContentIds: createNewContentIds(change, () => `${id}-new${++generatedIdCount}`),
        review: {},
        flags: [],
        requestText: '',
        createdAt: 0,
        ...version,
      },
    ],
    keptVersionId: versionId,
    status: 'accepted',
    isStale: false,
  };
}

/** Build a change ready to apply, with the ids `makeProposal` gives it. */
export const makeReviewedChange = (change: ProposalChange, id: string): ReviewedChange =>
  resolveProposal(makeProposal(change, id));
