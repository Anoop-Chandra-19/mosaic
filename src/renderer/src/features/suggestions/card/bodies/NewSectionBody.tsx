import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { AppButton, AppInput, Text } from '@/components/ui-kit';
import { ADDED_ROW } from '@/features/document-diff/diffMarks';
import { cn } from '@/lib/utils';
import type { ProposalVersion } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { renameProposedSection } from '../../proposals/proposalActions';
import { listNewEntries, resolveChange } from '../../proposals/reviewedChange';
import { readWholeChangeFlags } from '../../suggestionState';
import { readFlaggedWords } from '../text/describeFlag';
import { SuggestionFlags } from '../text/SuggestionFlags';
import { FlaggedText } from '../text/SuggestionText';
import { Caption, CaptionNote, Hint, SuggestedText } from './BodyParts';
import { NumbersToFillLine } from './EntryFacts';
import { NewEntryStack } from './NewEntryStack';
import type { SuggestionBodyProps } from './suggestionBodyProps';

/** The sections around where a new one goes: the one before it, and the one after. */
function readAround(draft: ResumeData, afterSectionId: string | null) {
  const ordered = [...draft.sections].sort((a, b) => a.order - b.order);
  const at = afterSectionId === null ? 0 : ordered.findIndex((s) => s.id === afterSectionId) + 1;
  return { previous: ordered[at - 1]?.label, next: ordered[at]?.label };
}

/** The new section's heading: the user's words, changed in place, nothing to confirm. */
function HeadingField({
  proposalId,
  versionId,
  label,
}: {
  proposalId: string;
  versionId: string;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const save = (value: string) => {
    renameProposedSection(proposalId, value, versionId);
    setIsOpen(false);
  };
  if (isOpen) {
    return (
      <AppInput
        autoFocus
        aria-label="Section heading"
        defaultValue={label}
        onBlur={(event) => save(event.currentTarget.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') save(event.currentTarget.value);
          else if (event.key === 'Escape') setIsOpen(false);
        }}
        className="h-6.5 w-45"
      />
    );
  }
  return (
    <AppButton
      variant="ghost"
      shape="text"
      title="Change the heading. It is your words, nothing to confirm"
      onClick={() => setIsOpen(true)}
      className="group/heading -ml-1 gap-1.5 rounded-[0.25rem] px-1 py-px"
    >
      <Text variant="title">{label}</Text>
      <Pencil className="size-2.75 text-ink-faint opacity-0 group-hover/heading:opacity-100" />
    </AppButton>
  );
}

/** A section's place among the others: its neighbours faint, itself at full ink. */
function SectionPlace({
  label,
  previous,
  next,
}: {
  label: string;
  previous?: string;
  next?: string;
}) {
  const neighbour = (text: string) => (
    <Text variant="secondary" className="truncate px-2.25 py-1 text-ink-faint">
      {text}
    </Text>
  );
  return (
    <div className="flex flex-col overflow-hidden rounded-sm border border-line bg-pane-raised [&>*+*]:border-t [&>*+*]:border-line">
      {previous && neighbour(previous)}
      <Text variant="strong" className={cn('px-2.25 py-1.25', ADDED_ROW)}>
        {label}
      </Text>
      {next && neighbour(next)}
    </div>
  );
}

/** The caption over the entries: how many there are, and how many the user left out. */
function EntriesCaption({ version }: { version: ProposalVersion }) {
  const entries = listNewEntries(version);
  const leftOutCount = entries.filter((entry) => entry.isLeftOut).length;
  const onCardCount = entries.length - leftOutCount;
  return (
    <Caption>
      With {onCardCount} {onCardCount === 1 ? 'entry' : 'entries'}
      {leftOutCount > 0 && <CaptionNote>{leftOutCount} left out</CaptionNote>}
    </Caption>
  );
}

/**
 * A suggested new section: its heading, where it goes, and its lines or entries. The user
 * keeps or drops it all at once. For a section of entries, they confirm each entry's facts
 * and can leave out some entries while keeping the rest.
 */
export function NewSectionBody({ proposal, version, draft }: SuggestionBodyProps) {
  const change = resolveChange(version);
  if (change.kind !== 'section') return null;
  const { section, contents } = change;
  // A section with nothing in it yet is not shown in review.
  if (contents === null) return null;
  const isLines = contents.layout === 'lines';
  const { previous, next } = readAround(draft, change.afterSectionId);

  return (
    <>
      <Caption>
        New section
        <CaptionNote>
          {section.kind === 'custom'
            ? 'custom, chosen by the assistant'
            : 'from the Add section menu'}
        </CaptionNote>
      </Caption>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-sm border border-add-line bg-add-soft px-2.25 py-1.75">
        <HeadingField proposalId={proposal.id} versionId={version.id} label={section.label} />
        <Text variant="secondary" className="text-ink-muted">
          {isLines ? 'Holds lines, like Skills' : 'Holds entries, like Experience'}
        </Text>
      </div>
      <Caption>
        Goes
        <CaptionNote>{previous ? `after ${previous}` : 'first'}</CaptionNote>
      </Caption>
      <SectionPlace label={section.label} previous={previous} next={next} />
      {isLines ? (
        <>
          <Caption>
            With {contents.lines.length} {contents.lines.length === 1 ? 'line' : 'lines'}
          </Caption>
          {contents.lines.map((line, index) => (
            <SuggestedText key={index} className="[&+&]:mt-1">
              <FlaggedText text={line} words={readFlaggedWords(version.flags)} />
            </SuggestedText>
          ))}
        </>
      ) : (
        <>
          <EntriesCaption version={version} />
          <NewEntryStack proposal={proposal} version={version} />
        </>
      )}
      {/*
       * The checks on an entry's bullets show on each bullet. The ones on a section's lines
       * look at all the lines at once, so they show once, here.
       */}
      <NumbersToFillLine version={version} />
      <SuggestionFlags flags={readWholeChangeFlags(version)} />
      <Hint>
        {isLines
          ? 'Keeping it keeps all of it. You can change any part in the editor after you apply.'
          : 'Keeping it keeps every entry you didn’t leave out. You can change any part in the editor after you apply.'}
      </Hint>
    </>
  );
}
