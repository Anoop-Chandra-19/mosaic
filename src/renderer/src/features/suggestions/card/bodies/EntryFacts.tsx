import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { AppButton, AppInput, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { EntryFact, Proposal } from '@/types/agentProposal';
import {
  chooseBulletWithoutNumber,
  confirmProposalFact,
  editProposalFact,
  fillBulletNumber,
} from '../../proposals/proposalActions';
import {
  isFactConfirmed,
  listNewBullets,
  listNewEntries,
  listWrittenFacts,
  type NewBullet,
  type NewEntry,
} from '../../proposals/reviewedChange';
import { readWholeChangeFlags } from '../../suggestionState';
import { readFlaggedWords } from '../text/describeFlag';
import { GapField } from '../text/GapField';
import { SuggestionFlags } from '../text/SuggestionFlags';
import { FlaggedText } from '../text/SuggestionText';
import { BackLink, CardTag, SuggestedText, TagLine } from './BodyParts';

const FACT_LABELS: Record<EntryFact, string> = {
  title: 'Title',
  organization: 'Organization',
  location: 'Place',
  dates: 'Dates',
};

interface FactRowsProps {
  proposal: Proposal;
  entry: NewEntry;
  /** Called when the user confirms the last unconfirmed fact of the entry. */
  onEntryConfirmed?: () => void;
  className?: string;
}

/** A new entry's facts, one row each. The user confirms each fact, or corrects it in place. */
export function FactRows({ proposal, entry, onEntryConfirmed, className }: FactRowsProps) {
  const [openFact, setOpenFact] = useState<EntryFact | null>(null);
  const { entryId } = entry.ids;
  const facts = listWrittenFacts(entry.draft);
  const editedFacts = proposal.review.factEdits?.[entryId] ?? {};
  /** Check whether every other fact of the entry is already confirmed. */
  const isLastFactLeft = (fact: EntryFact) =>
    facts.every((other) => other === fact || isFactConfirmed(proposal, { entryId, fact: other }));
  const confirm = (fact: EntryFact, isConfirmed: boolean) => {
    const isSaved = confirmProposalFact(proposal.id, { entryId, fact }, isConfirmed);
    if (isSaved && isConfirmed && isLastFactLeft(fact)) onEntryConfirmed?.();
  };
  const saveEdit = (fact: EntryFact, text: string) => {
    const wasConfirmed = isFactConfirmed(proposal, { entryId, fact });
    const isSaved = editProposalFact(proposal.id, { entryId, fact }, text);
    if (isSaved && !wasConfirmed && isLastFactLeft(fact)) onEntryConfirmed?.();
  };

  return facts.map((fact) => {
    const value = entry.draft.frame[fact] ?? '';
    const isConfirmed = isFactConfirmed(proposal, { entryId, fact });
    const label = FACT_LABELS[fact];
    return (
      <div
        key={fact}
        className={cn(
          'mb-1 grid grid-cols-[5.25rem_minmax(0,1fr)_auto_1.5625rem] items-center gap-2 rounded-sm border border-line bg-pane-raised py-1 pr-1 pl-2',
          isConfirmed && 'border-add-line',
          className
        )}
      >
        <Text variant="secondary" className="text-ink-muted">
          {label}
        </Text>
        {openFact === fact ? (
          <AppInput
            autoFocus
            aria-label={label}
            defaultValue={value}
            onBlur={() => setOpenFact(null)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                saveEdit(fact, event.currentTarget.value);
                setOpenFact(null);
              } else if (event.key === 'Escape') {
                setOpenFact(null);
              }
            }}
            className="h-6 px-1.5"
          />
        ) : (
          <AppButton
            variant="ghost"
            shape="text"
            title="Change it"
            onClick={() => setOpenFact(fact)}
            // The text shape lets text wrap. A fact stays on one line and ends in an ellipsis
            // when it is too long, as in the design.
            className="-ml-1 min-w-0 justify-start truncate rounded-[0.25rem] px-1 py-px text-left whitespace-nowrap text-foreground"
          >
            {value}
          </AppButton>
        )}
        <Text variant="meta" className="whitespace-nowrap text-ink-faint">
          {editedFacts[fact] !== undefined ? 'your words' : ''}
        </Text>
        <AppButton
          variant={isConfirmed ? 'kept' : 'outline'}
          size="xs"
          shape="square"
          aria-pressed={isConfirmed}
          aria-label={
            isConfirmed ? `${label} confirmed. Click to undo` : `Confirm ${label.toLowerCase()}`
          }
          onClick={() => confirm(fact, !isConfirmed)}
          className={cn(!isConfirmed && 'text-ink-faint')}
        >
          <Check />
        </AppButton>
      </div>
    );
  });
}

/**
 * A new entry's bullets. Words the checks flagged are marked. A bullet that a later run
 * added is labelled "just added".
 */
/**
 * One bullet of a new entry: its own checks under it, and a number to fill as a field in
 * the sentence, with the version without a number one click away.
 */
function EntryBullet({ proposal, bullet }: { proposal: Proposal; bullet: NewBullet }) {
  const flags = proposal.flags.filter((flag) => flag.textId === bullet.id);
  const isJustAdded = proposal.lateIds?.includes(bullet.id) ?? false;
  return (
    <div className="[&+&]:mt-1.5">
      <div className="flex items-start gap-1.75">
        <Text variant="meta" className="min-w-2.5 text-ink-faint">
          •
        </Text>
        <SuggestedText>
          <FlaggedText
            text={bullet.text}
            words={readFlaggedWords(flags)}
            gap={
              <GapField
                value={bullet.filledNumber}
                onFill={(number) => fillBulletNumber(proposal.id, bullet.id, number)}
              />
            }
          />
          {isJustAdded && <CardTag className="ml-1.5 align-px">just added</CardTag>}
        </SuggestedText>
      </div>
      {/* Indented so it lines up with the bullet's text, not its bullet mark. */}
      <div className="pl-4.25">
        <SuggestionFlags flags={flags} isCompact />
        {bullet.isWithoutNumber ? (
          <BackLink onClick={() => chooseBulletWithoutNumber(proposal.id, bullet.id, false)}>
            Back to the version with a number
          </BackLink>
        ) : (
          bullet.gap && (
            <AppButton
              variant="quiet"
              size="xs"
              onClick={() => chooseBulletWithoutNumber(proposal.id, bullet.id, true)}
              className="mt-1 -ml-2"
            >
              Use the version without a number
            </AppButton>
          )
        )}
      </div>
    </div>
  );
}

export function EntryBullets({ proposal, entry }: { proposal: Proposal; entry: NewEntry }) {
  return listNewBullets(proposal, entry).map((bullet) => (
    <EntryBullet key={bullet.id} proposal={proposal} bullet={bullet} />
  ));
}

/** What happens at Apply while a bullet waits on its number, and what the user can do about it. */
const HELD_BACK_ADVICE: Record<'section' | 'entry', string> = {
  section:
    'If you keep the section now, Apply holds it back. Fill in the number, use the version without one, or leave that entry out.',
  entry:
    'If you keep the entry now, Apply holds it back. Fill in the number, or use the version without one.',
};

/**
 * Tell the user how many bullets still need a number, and that Apply holds the section or
 * entry back until each one has a number or uses the version without one. Shows nothing
 * when no bullet needs a number.
 */
export function NumbersToFillLine({ proposal }: { proposal: Proposal }) {
  const count = proposal.flags.filter((flag) => flag.kind === 'unfilledGap' && flag.textId).length;
  if (!count) return null;
  const waiting =
    count === 1 ? 'A bullet still needs a number.' : `${count} bullets still need numbers.`;
  const holder = proposal.change.kind === 'section' ? 'section' : 'entry';
  return (
    <TagLine icon={Lock}>
      {waiting} {HELD_BACK_ADVICE[holder]}
    </TagLine>
  );
}

/**
 * A suggested new entry in an existing section: its facts to confirm, its bullets, and
 * what the checks found in them.
 */
export function EntryFacts({ proposal }: { proposal: Proposal }) {
  const [entry] = listNewEntries(proposal);
  if (!entry) return null;
  const facts = listWrittenFacts(entry.draft);
  const confirmedCount = facts.filter((fact) =>
    isFactConfirmed(proposal, { entryId: entry.ids.entryId, fact })
  ).length;

  return (
    <div>
      <div className="mb-2 flex justify-between gap-2.5">
        <Text variant="secondary" className="text-ink-soft">
          These are facts about you. Confirm each one.
        </Text>
        <Text variant="meta" className="text-ink-faint">
          {confirmedCount} of {facts.length}
        </Text>
      </div>
      <FactRows proposal={proposal} entry={entry} />
      <div className="mt-2.25">
        <EntryBullets proposal={proposal} entry={entry} />
      </div>
      <NumbersToFillLine proposal={proposal} />
      <SuggestionFlags flags={readWholeChangeFlags(proposal)} />
    </div>
  );
}
