import { useState } from 'react';
import { Info } from 'lucide-react';
import { AppButton, AppToggleGroup, AppToggleGroupItem, Text } from '@/components/ui-kit';
import type { Proposal, ProposalVersion } from '@/types/agentProposal';
import {
  cancelStaleReview,
  clearProposalEdit,
  fillProposalNumber,
} from '../../proposals/proposalActions';
import { readKeptVersion, readVersionNumber } from '../../proposals/proposalVersions';
import { resolveChange } from '../../proposals/reviewedChange';
import { VersionCaption } from '../versions/VersionCaption';
import { readFlaggedWords, readLostWords } from '../text/describeFlag';
import { GapField } from '../text/GapField';
import { SuggestionEditor } from '../text/SuggestionEditor';
import { SuggestionFlags } from '../text/SuggestionFlags';
import { FlaggedText, MarkedText } from '../text/SuggestionText';
import { nameTextPlace, type TextNoun } from '../text/suggestionWords';
import { WithoutNumberChoice } from './WithoutNumberChoice';
import { BackLink, Caption, CaptionTag, Lines, SuggestedText } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';

/** What the version writes before the gap is filled: the user's words, or the assistant's. */
function readShownAfter({ change, review }: ProposalVersion): string {
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

/** Which text the marked changes are compared with: the user's text, or the kept version. */
type MarksAgainst = 'yours' | 'kept';

export function RewriteBody({
  proposal,
  version,
  draft,
  isEditing,
  onEditingChange,
}: SuggestionBodyProps) {
  const [marksAgainst, setMarksAgainst] = useState<MarksAgainst>('yours');
  const change = resolveChange(version);
  if (change.kind !== 'rewrite' && change.kind !== 'merge') return null;
  const { review } = version;
  const isMerge = change.kind === 'merge';
  const noun = isMerge ? 'bullet' : nameTextPlace(draft, change.place);
  const isRebased = review.rebasedBefore !== undefined;
  const kept = proposal.status === 'accepted' ? readKeptVersion(proposal) : null;
  const otherKept = kept && kept.id !== version.id ? kept : null;
  const keptNumber = otherKept ? readVersionNumber(proposal, otherKept.id) : 0;
  const isAgainstKept = otherKept !== null && marksAgainst === 'kept';
  const before = isAgainstKept ? [readWrittenText(otherKept)] : [change.before].flat();
  // Compared with the kept version, the marks show what changed between the two versions.
  // The checks compare with the user's text, so their flags are hidden here.
  const flags = isAgainstKept ? [] : version.flags;
  const lost = readLostWords(flags);
  const gap = (
    <GapField
      value={review.filledNumber}
      onFill={(number) => fillProposalNumber(proposal.id, number, version.id)}
    />
  );
  const nowCaption = isAgainstKept
    ? `Version ${keptNumber}, kept`
    : readNowCaption(isMerge, isRebased, noun);

  return (
    <>
      {isRebased && <RebasedNote proposal={proposal} noun={noun} />}
      <Caption>{nowCaption}</Caption>
      <div>
        <Lines
          isNumbered={isMerge && !isAgainstKept}
          look="now"
          lines={before.map((text) => (
            <FlaggedText key={text} text={text} words={lost} />
          ))}
        />
      </div>
      <VersionCaption
        proposal={proposal}
        version={version}
        label={isMerge ? 'Suggested, one bullet' : 'Suggested'}
      >
        {review.userText !== undefined && !isEditing && <CaptionTag>in your words</CaptionTag>}
      </VersionCaption>
      {otherKept && (
        <AppToggleGroup
          type="single"
          size="sm"
          aria-label="Mark the changes"
          value={marksAgainst}
          onValueChange={(value) => value && setMarksAgainst(value as MarksAgainst)}
          className="mb-1.5"
        >
          <AppToggleGroupItem value="yours">Against your {noun}</AppToggleGroupItem>
          <AppToggleGroupItem value="kept">Changes from version {keptNumber}</AppToggleGroupItem>
        </AppToggleGroup>
      )}
      {isEditing ? (
        <SuggestionEditor
          proposal={proposal}
          version={version}
          onDone={() => onEditingChange(false)}
        />
      ) : (
        <>
          <SuggestedText className="text-pretty" onDoubleClick={() => onEditingChange(true)}>
            <MarkedText
              before={before.join(' ')}
              after={readShownAfter(version)}
              words={readFlaggedWords(flags)}
              gap={gap}
            />
          </SuggestedText>
          <SuggestionFlags flags={flags} />
          <WithoutNumberChoice proposalId={proposal.id} version={version} />
          {review.userText !== undefined && (
            <BackLink onClick={() => clearProposalEdit(proposal.id, version.id)}>
              Back to the assistant’s wording
            </BackLink>
          )}
        </>
      )}
    </>
  );
}

/** The text a version writes, with the user's edits in it. */
function readWrittenText(version: ProposalVersion): string {
  const change = resolveChange(version);
  return change.kind === 'rewrite' || change.kind === 'merge' ? change.after : '';
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
