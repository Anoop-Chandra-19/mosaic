import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';

/** What every body is drawn from: the suggestion, and the draft it was made for. */
export interface SuggestionBodyProps {
  proposal: Proposal;
  /** The draft as it is now, for what its text says today. */
  draft: ResumeData;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
}
