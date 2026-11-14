import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume } from './applyProposalsToResume';
import { listNewContentIds } from '../newContentIds';
import { resolveChange } from '../reviewedChange';

/** Collect every section, entry, line and bullet id in a document. */
function listDocumentIds(doc: ResumeData): Set<string> {
  const ids = new Set<string>();
  for (const section of doc.sections) {
    ids.add(section.id);
    for (const item of section.items) {
      ids.add(item.id);
      for (const bullet of item.bullets) ids.add(bullet.id);
    }
  }
  return ids;
}

/**
 * Apply one proposal as the user reviewed it. Returns the new document and the ids of what
 * the proposal added, parent first, or null when the proposal no longer fits. Empty bullets
 * and lines are not added, so their ids are left out.
 */
export function layInProposal(
  doc: ResumeData,
  proposal: Proposal
): { doc: ResumeData; createdIds: string[] } | null {
  const laidIn = applyProposalsToResume(doc, [{ ...proposal, change: resolveChange(proposal) }]);
  if (!laidIn.appliedIds.length) return null;
  const idsNow = listDocumentIds(laidIn.doc);
  return {
    doc: laidIn.doc,
    createdIds: listNewContentIds(proposal.newContentIds).filter((id) => idsNow.has(id)),
  };
}
