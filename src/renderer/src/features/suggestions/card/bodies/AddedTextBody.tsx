import { Info } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { ADDED_ROW } from '@/features/document-diff/diffMarks';
import { findEntry, findSection } from '@/lib/resume/proposalAnchor';
import { cn } from '@/lib/utils';
import type { AddPlace, Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import {
  cancelPlacedLast,
  clearProposalEdit,
  fillProposalNumber,
} from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { BackLink, Caption, CaptionNote, CaptionTag, TagLine } from './BodyParts';
import { readFlaggedWords } from '../text/describeFlag';
import { GapField } from '../text/GapField';
import type { SuggestionBodyProps } from './suggestionBodyProps';
import { SuggestionEditor } from '../text/SuggestionEditor';
import { SuggestionFlags } from '../text/SuggestionFlags';
import { FlaggedText } from '../text/SuggestionText';
import { nameAddedContainer } from '../text/suggestionWords';

/** The bullets or lines new text goes among, as the draft holds them. */
function readAmong(draft: ResumeData, place: AddPlace): { id: string; text: string }[] {
  if (place.unit === 'line') {
    return (findSection(draft, place.sectionId)?.items ?? []).map(({ id, text }) => ({
      id,
      text: text ?? '',
    }));
  }
  return findEntry(draft, place.sectionId, place.entryId)?.bullets ?? [];
}

/** "after “Reduced p99 latency…”", "first in Harbor Freight Labs". */
const shorten = (text: string) => {
  const words = text.split(/\s+/);
  return words.length > 4 ? `${words.slice(0, 4).join(' ')}…` : text;
};

/** A neighbour of the new text: faint, cut to one line. */
function Neighbour({ text, marker }: { text: string; marker: string }) {
  return (
    <div className="flex items-start gap-1.75 px-2.25 py-1 text-ink-faint">
      <Text variant="meta" className="min-w-2.5 text-ink-faint">
        {marker}
      </Text>
      <Text variant="secondary" className="min-w-0 truncate text-ink-faint">
        {text}
      </Text>
    </div>
  );
}

/**
 * An added bullet or line, shown in its place between its neighbours. It has no "Now":
 * there is no before, so the new text is the only text at full ink.
 */
export function AddedTextBody({
  proposal,
  draft,
  isEditing,
  onEditingChange,
}: SuggestionBodyProps) {
  const change = resolveChange(proposal);
  if (change.kind !== 'add') return null;
  const { review, flags } = proposal;
  const isLine = change.place.unit === 'line';
  const marker = isLine ? '' : '•';
  const among = readAmong(draft, change.place);
  const at =
    change.afterId === null ? 0 : among.findIndex((item) => item.id === change.afterId) + 1;
  const previous = among[at - 1];
  const next = among[at];
  const container = nameAddedContainer(draft, change.place);
  const where = previous ? `after “${shorten(previous.text)}”` : `first in ${container}`;

  return (
    <>
      {review.placedAfterId !== undefined && (
        <PlacedLastNote proposal={proposal} noun={isLine ? 'line' : 'bullet'} />
      )}
      <Caption>
        New {isLine ? 'line' : 'bullet'}
        <CaptionNote>{among.length ? where : `in ${container}`}</CaptionNote>
        {review.userText !== undefined && !isEditing && <CaptionTag>in your words</CaptionTag>}
      </Caption>
      <div className="flex flex-col overflow-hidden rounded-sm border border-line bg-pane-raised [&>*+*]:border-t [&>*+*]:border-line">
        {previous && <Neighbour text={previous.text} marker={marker} />}
        <div className={cn('flex items-start gap-1.75 px-2.25 py-1.25', ADDED_ROW)}>
          {marker && (
            <Text variant="meta" className="min-w-2.5 text-ink-faint">
              {marker}
            </Text>
          )}
          {isEditing ? (
            <div className="min-w-0 flex-1">
              <SuggestionEditor proposal={proposal} onDone={() => onEditingChange(false)} />
            </div>
          ) : (
            <Text
              variant="body"
              className="min-w-0 flex-1 text-pretty"
              onDoubleClick={() => onEditingChange(true)}
            >
              <FlaggedText
                text={change.text}
                words={readFlaggedWords(flags)}
                gap={
                  <GapField
                    value={review.filledNumber}
                    onFill={(number) => fillProposalNumber(proposal.id, number)}
                  />
                }
              />
            </Text>
          )}
        </div>
        {next && <Neighbour text={next.text} marker={marker} />}
      </div>
      {!among.length && isLine && (
        <TagLine icon={Info}>
          {container} is empty now, so nothing of it prints. Its heading prints once this line
          lands.
        </TagLine>
      )}
      {!isEditing && <SuggestionFlags flags={flags} />}
      {!isEditing && review.userText !== undefined && (
        <BackLink onClick={() => clearProposalEdit(proposal.id)}>
          Back to the assistant’s wording
        </BackLink>
      )}
    </>
  );
}

/** Its place was gone, so the user put it last: it now waits there as usual. */
function PlacedLastNote({ proposal, noun }: { proposal: Proposal; noun: string }) {
  return (
    <div className="mb-1 flex flex-wrap items-start gap-x-1.75 gap-y-1 rounded-sm bg-line px-2.25 py-1.75">
      <Info className="mt-0.75 size-3 shrink-0 text-ink-muted" />
      <Text variant="secondary" className="min-w-45 flex-1 text-ink-soft">
        The {noun} it was to follow is gone, so it now goes last. Keep or drop it as usual.
      </Text>
      <AppButton
        variant="link"
        size="xs"
        shape="text"
        className="p-0"
        onClick={() => cancelPlacedLast(proposal.id)}
      >
        Cancel
      </AppButton>
    </div>
  );
}
