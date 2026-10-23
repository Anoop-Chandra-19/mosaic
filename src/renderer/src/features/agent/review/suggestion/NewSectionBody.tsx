import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { AppButton, AppInput, Text } from '@/components/ui-kit';
import type { ResumeData } from '@shared/types/resume';
import { renameProposedSection } from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { Caption, CaptionNote } from './BodyParts';
import { EntryFacts } from './EntryFacts';
import type { SuggestionBodyProps } from './SuggestionBody';

/** The sections around where a new one goes: the one before it, and the one after. */
function readAround(draft: ResumeData, afterSectionId: string | null) {
  const ordered = [...draft.sections].sort((a, b) => a.order - b.order);
  const at = afterSectionId === null ? 0 : ordered.findIndex((s) => s.id === afterSectionId) + 1;
  return { previous: ordered[at - 1]?.label, next: ordered[at]?.label };
}

/** The new section's heading: the user's words, changed in place, nothing to confirm. */
function HeadingField({ proposalId, label }: { proposalId: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const save = (value: string) => {
    renameProposedSection(proposalId, value);
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
      <Text
        variant="strong"
        className="bg-add-soft px-2.25 py-1.25 shadow-[inset_2px_0_0_var(--add)]"
      >
        {label}
      </Text>
      {next && neighbour(next)}
    </div>
  );
}

/**
 * A new section arrives with what goes in it: one decision for its heading, place and
 * contents. Its first entry's facts are confirmed one by one, as a new entry's are.
 */
export function NewSectionBody({ proposal, draft }: SuggestionBodyProps) {
  const change = resolveChange(proposal);
  if (change.kind !== 'section') return null;
  const { section, contents } = change;
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
        <HeadingField proposalId={proposal.id} label={section.label} />
        <Text variant="secondary" className="text-ink-muted">
          {isLines ? 'Holds lines, like Skills' : 'Holds entries, like Experience'}
        </Text>
      </div>
      <Caption>
        Goes
        <CaptionNote>{previous ? `after ${previous}` : 'first'}</CaptionNote>
      </Caption>
      <SectionPlace label={section.label} previous={previous} next={next} />
      <Caption>
        {isLines
          ? `With ${contents.lines.length} ${contents.lines.length === 1 ? 'line' : 'lines'}`
          : 'With its first entry'}
      </Caption>
      {isLines ? (
        contents.lines.map((line, index) => (
          <Text as="p" key={index} variant="body" className="[&+&]:mt-1">
            {line}
          </Text>
        ))
      ) : (
        <EntryFacts proposal={proposal} />
      )}
      <Text as="p" variant="secondary" className="mt-2 text-ink-faint">
        Keeping it keeps all of it. Change any part in the editor once it lands.
      </Text>
    </>
  );
}
