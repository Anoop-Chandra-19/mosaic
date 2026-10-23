import { ArrowRight } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { clearProposalEdit } from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { BackLink, Caption, CaptionTag } from './BodyParts';
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
          <Text
            variant="title"
            className="text-ink-muted line-through decoration-del decoration-[1.5px]"
          >
            {change.before}
          </Text>
          <ArrowRight className="size-3 text-ink-faint" />
          <Text
            variant="title"
            className="rounded-[0.125rem] bg-add-soft px-0.5 font-strong shadow-[inset_0_-1.5px_0_var(--add-line)]"
          >
            {change.after}
          </Text>
        </div>
      )}
      {!isEditing && (
        <Text as="p" variant="secondary" className="mt-2 text-ink-faint">
          Your words, not a fact, so there is nothing to check. Only the heading changes.
        </Text>
      )}
      {!isEditing && isInTheirWords && (
        <BackLink onClick={() => clearProposalEdit(proposal.id)}>
          Back to the assistant’s wording
        </BackLink>
      )}
    </>
  );
}
