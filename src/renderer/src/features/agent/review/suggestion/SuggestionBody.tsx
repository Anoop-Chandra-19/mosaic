import type { ReactNode } from 'react';
import { Eye, EyeOff, Info, Move } from 'lucide-react';
import { AppButton, Chip, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalChange, ProposalChangeKind } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { findEntry, findSection } from '../../proposals/proposalAnchor';
import {
  cancelStaleReview,
  chooseVersionWithoutNumber,
  clearProposalEdit,
  fillProposalNumber,
} from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { AddedTextBody } from './AddedTextBody';
import { BlockBody } from './BlockBody';
import { BackLink, Caption, CaptionTag, Lines, TagLine } from './BodyParts';
import { readFlaggedWords, readLostWords } from './describeFlag';
import { EntryFacts } from './EntryFacts';
import { GapField } from './GapField';
import { StaleBody } from './StaleBody';
import { SuggestionEditor } from './SuggestionEditor';
import { SuggestionFlags } from './SuggestionFlags';
import { FlaggedText, MarkedText } from './SuggestionText';
import { nameEntry, nameTextPlace, type TextNoun } from './suggestionWords';

/*
 * One suggestion, read beside the user's words: shared by the inspector and the Compare all
 * cards. A body per kind; an out-of-date one shows what changed under it instead.
 */

export interface SuggestionBodyProps {
  proposal: Proposal;
  /** The draft as it is now, for what its text says today. */
  draft: ResumeData;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
}

export function SuggestionBody(props: SuggestionBodyProps) {
  if (props.proposal.isStale) return <StaleBody {...props} />;
  const Body = KIND_BODIES[props.proposal.change.kind];
  return <Body {...props} />;
}

const KIND_BODIES: Record<ProposalChangeKind, (props: SuggestionBodyProps) => ReactNode> = {
  rewrite: RewriteBody,
  merge: RewriteBody,
  split: SplitBody,
  reorder: ReorderBody,
  select: SelectBody,
  add: AddedTextBody,
  entry: ({ proposal }) => <EntryFacts proposal={proposal} />,
};

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

function RewriteBody({ proposal, draft, isEditing, onEditingChange }: SuggestionBodyProps) {
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
          variant="secondary"
          className="text-ink-soft"
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
          <Text
            as="p"
            variant="body"
            className="text-pretty"
            onDoubleClick={() => onEditingChange(true)}
          >
            <MarkedText
              before={before.join(' ')}
              after={readShownAfter(proposal)}
              words={readFlaggedWords(flags)}
              gap={gap}
            />
          </Text>
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

function SplitBody({ proposal }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'split') return null;
  const parts = [change.before.slice(0, change.at), change.before.slice(change.at)];
  return (
    <>
      <Caption>Now, one bullet</Caption>
      <Text as="p" variant="secondary" className="text-ink-soft">
        {parts[0]}
        <span
          title="Splits here"
          className="mx-0.75 -mb-0.5 inline-block h-3.5 w-0.5 rounded-[0.0625rem] bg-amber"
        />
        {parts[1]}
      </Text>
      <Caption>
        Suggested, two bullets <CaptionTag>same words</CaptionTag>
      </Caption>
      <div>
        <Lines isNumbered variant="body" lines={parts.map((part) => part.trim())} />
      </div>
    </>
  );
}

/** What a reordered item is called: a section's label, a line's or bullet's text, an entry's name. */
function nameReordered(
  draft: ResumeData,
  change: Extract<ProposalChange, { kind: 'reorder' }>,
  id: string
) {
  const { place } = change;
  if (place.unit === 'sections') return findSection(draft, id)?.label;
  if (place.unit === 'bullets') {
    return findEntry(draft, place.sectionId, place.entryId)?.bullets.find((b) => b.id === id)?.text;
  }
  const section = findSection(draft, place.sectionId);
  const item = section?.items.find((each) => each.id === id);
  return section?.layout === 'lines' ? item?.text : nameEntry(item);
}

function ReorderBody({ proposal, draft }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'reorder') return null;
  return (
    <>
      <Caption>Suggested order</Caption>
      <div className="flex flex-col gap-1.5">
        {change.after.map((id, index) => {
          const from = change.before.indexOf(id) + 1;
          const isMoved = from !== index + 1;
          return (
            <div
              key={id}
              className={cn(
                'flex items-center gap-2.5 rounded-sm border border-line bg-pane-raised px-2.5 py-2',
                isMoved && 'border-add-line bg-add-soft'
              )}
            >
              <Text variant="meta" className="text-ink-faint">
                {index + 1}
              </Text>
              <Text variant="body" className="min-w-0 flex-1 truncate">
                {nameReordered(draft, change, id)}
              </Text>
              {isMoved && (
                <Chip tone="add">
                  <Move />
                  {from} → {index + 1}
                </Chip>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SelectBody(props: SuggestionBodyProps) {
  const { change } = props.proposal;
  if (change.kind !== 'select') return null;
  if (change.place.unit === 'entry' || change.place.unit === 'section') {
    return <BlockBody {...props} />;
  }
  return (
    <>
      <Caption>Suggested</Caption>
      <Text
        as="p"
        variant="body"
        className={cn(!change.selected && 'text-ink-muted line-through decoration-del')}
      >
        {change.before}
      </Text>
      <TagLine icon={change.selected ? Eye : EyeOff}>
        {change.selected
          ? 'Back on the page.'
          : 'Off the page, still in your content. Show it again from the editor any time.'}
      </TagLine>
    </>
  );
}
