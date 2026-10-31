import { ArrowRight } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { DIFF_MARKS } from '@/features/document-diff/diffMarks';
import { cn } from '@/lib/utils';
import { clearProposalEdit } from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { BackLink, Caption, CaptionTag, Hint } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';
import { SuggestionEditor } from '../text/SuggestionEditor';

/** A heading is short and the user's own words: old → new in full, never a word diff. */
export function RenameBody({ proposal, isEditing, onEditingChange }: SuggestionBodyProps) {
  const change = resolveChange(proposal);
  if (change.kind !== 'rename') return null;
  const isInTheirWords = proposal.review.userText !== undefined;
  return (
    <>
      <Caption>
        Section heading
        {isInTheirWords && !isEditing && <CaptionTag>in your words</CaptionTag>}
      </Caption>
      {isEditing ? (
        <SuggestionEditor proposal={proposal} onDone={() => onEditingChange(false)} />
      ) : (
        <div
          className="flex flex-wrap items-center gap-x-2.25 gap-y-1.5"
          onDoubleClick={() => onEditingChange(true)}
        >
          <Text variant="title" className={DIFF_MARKS.removed}>
            {change.before}
          </Text>
          <ArrowRight className="size-3 text-ink-faint" />
          <Text variant="title" className={cn(DIFF_MARKS.added, 'font-strong')}>
            {change.after}
          </Text>
        </div>
      )}
      {!isEditing && (
        <Hint>Your words, not a fact, so there is nothing to check. Only the heading changes.</Hint>
      )}
      {!isEditing && isInTheirWords && (
        <BackLink onClick={() => clearProposalEdit(proposal.id)}>
          Back to the assistant’s wording
        </BackLink>
      )}
    </>
  );
}
