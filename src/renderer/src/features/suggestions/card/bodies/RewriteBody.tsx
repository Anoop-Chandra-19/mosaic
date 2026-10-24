import { Info } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import type { Proposal } from '@shared/types/agentProposal';
import {
  cancelStaleReview,
  chooseVersionWithoutNumber,
  clearProposalEdit,
  fillProposalNumber,
} from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { readFlaggedWords, readLostWords } from '../text/describeFlag';
import { GapField } from '../text/GapField';
import { SuggestionEditor } from '../text/SuggestionEditor';
import { SuggestionFlags } from '../text/SuggestionFlags';
import { FlaggedText, MarkedText } from '../text/SuggestionText';
import { nameTextPlace, type TextNoun } from '../text/suggestionWords';
import { BackLink, Caption, CaptionTag, Lines, SuggestedText } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';

/** What the suggestion writes before the gap is filled: the user's words, or the assistant's. */
function readShownAfter({ change, review }: Proposal): string {
  if (change.kind !== 'rewrite' && change.kind !== 'merge') return '';
  if (review.userText !== undefined) return review.userText;
  if (change.kind === 'rewrite' && change.gap && review.isWithoutNumber) {
    return change.gap.withoutNumber;
  }
  return change.after;
}

/** "Now" names the text only where a bullet goes without saying. */
const NOW_CAPTIONS: Record<TextNoun, string> = {
  bullet: 'Now',
  line: 'Now, this line',
  summary: 'Now, your summary',
};

export function RewriteBody({ proposal, draft, isEditing, onEditingChange }: SuggestionBodyProps) {
  const change = resolveChange(proposal);
  if (change.kind !== 'rewrite' && change.kind !== 'merge') return null;
  const { review, flags } = proposal;
  const isMerge = change.kind === 'merge';
  const noun = isMerge ? 'bullet' : nameTextPlace(draft, change.place);
  const isRebased = review.rebasedBefore !== undefined;
  const before = isMerge ? change.before : [change.before];
  const lost = readLostWords(flags);
  const gap = (
    <GapField
      value={review.filledNumber}
      onFill={(number) => fillProposalNumber(proposal.id, number)}
    />
  );
  const original = proposal.change;
  const withoutNumber =
    original.kind === 'rewrite' && review.userText === undefined
      ? original.gap?.withoutNumber
      : undefined;

  return (
    <>
      {isRebased && <RebasedNote proposal={proposal} noun={noun} />}
      <Caption>{readNowCaption(isMerge, isRebased, noun)}</Caption>
      <div>
        <Lines
          isNumbered={isMerge}
          look="now"
          lines={before.map((text) => (
            <FlaggedText key={text} text={text} words={lost} />
          ))}
        />
      </div>
      <Caption>
        {isMerge ? 'Suggested, one bullet' : 'Suggested'}
        {review.userText !== undefined && !isEditing && <CaptionTag>in your words</CaptionTag>}
      </Caption>
      {isEditing ? (
        <SuggestionEditor proposal={proposal} onDone={() => onEditingChange(false)} />
      ) : (
        <>
          <SuggestedText className="text-pretty" onDoubleClick={() => onEditingChange(true)}>
            <MarkedText
              before={before.join(' ')}
              after={readShownAfter(proposal)}
              words={readFlaggedWords(flags)}
              gap={gap}
            />
          </SuggestedText>
          <SuggestionFlags flags={flags} />
          {withoutNumber !== undefined &&
            (review.isWithoutNumber ? (
              <BackLink onClick={() => chooseVersionWithoutNumber(proposal.id, false)}>
                Back to the version with a number
              </BackLink>
            ) : (
              <div className="mt-2.5 rounded-sm border border-line-strong bg-pane-raised px-2.5 pt-2 pb-2.5">
                <Caption>Or, with no number</Caption>
                <Text as="p" variant="secondary" className="text-ink-soft">
                  {withoutNumber}
                </Text>
                <AppButton
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={() => chooseVersionWithoutNumber(proposal.id, true)}
                >
                  Use this one
                </AppButton>
              </div>
            ))}
          {review.userText !== undefined && (
            <BackLink onClick={() => clearProposalEdit(proposal.id)}>
              Back to the assistant’s wording
            </BackLink>
          )}
        </>
      )}
    </>
  );
}

function readNowCaption(isMerge: boolean, isRebased: boolean, noun: TextNoun): string {
  if (isMerge) return 'Now, two bullets';
  return isRebased ? `Your edited ${noun}` : NOW_CAPTIONS[noun];
}

/** Out of date, but shown against the text as the user left it, on their say-so. */
function RebasedNote({ proposal, noun }: { proposal: Proposal; noun: TextNoun }) {
  return (
    <div className="mb-1 flex flex-wrap items-start gap-x-1.75 gap-y-1 rounded-sm bg-line px-2.25 py-1.75">
      <Info className="mt-0.75 size-3 shrink-0 text-ink-muted" />
      <Text variant="secondary" className="min-w-45 flex-1 text-ink-soft">
        Now shown against your edited {noun}. Keeping it replaces your edit; undo and history still
        have it.
      </Text>
      <AppButton
        variant="link"
        size="xs"
        shape="text"
        className="p-0"
        onClick={() => cancelStaleReview(proposal.id)}
      >
        Cancel
      </AppButton>
    </div>
  );
}
