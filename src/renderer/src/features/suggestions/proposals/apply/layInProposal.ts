import type { Proposal } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume } from './applyProposalsToResume';
import { resolveChange } from '../reviewedChange';

/**
 * One proposal laid into a document as the user reviewed it, with the ids of what it made
 * (a split's second half, added text, a new entry or section); null when it no longer fits.
 * Laid in one at a time, in the apply order, what each one made is known to be its own.
 */
export function layInProposal(
  doc: ResumeData,
  proposal: Proposal
): { doc: ResumeData; createdIds: string[] } | null {
  const createdIds: string[] = [];
  const createId = () => {
    const id = crypto.randomUUID();
    createdIds.push(id);
    return id;
  };
  const laidIn = applyProposalsToResume(
    doc,
    [{ ...proposal, change: resolveChange(proposal) }],
    createId
  );
  return laidIn.appliedIds.length ? { doc: laidIn.doc, createdIds } : null;
}
