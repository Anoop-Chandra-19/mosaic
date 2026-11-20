import type { Proposal, ProposalVersion } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';

/** The props every card body takes: the suggestion, the version to show, and the draft. */
export interface SuggestionBodyProps {
  proposal: Proposal;
  /** The version of the suggestion that the card shows. */
  version: ProposalVersion;
  /** The draft as it is now, for what its text says today. */
  draft: ResumeData;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
}
