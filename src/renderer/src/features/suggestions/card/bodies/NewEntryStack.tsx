import { use } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/types/agentProposal';
import { leaveEntryOut, putEntryBack } from '../../proposals/proposalActions';
import {
  findUnconfirmedFacts,
  listNewEntries,
  listWrittenFacts,
  type EntryFactPlace,
  type NewEntry,
} from '../../proposals/reviewedChange';
import {
  findNextEntryToOpen,
  readOpenEntryId,
  SuggestionSelection,
} from '../../review/suggestionSelection';
import { CardTag, Hint } from './BodyParts';
import { EntryBullets, FactRows } from './EntryFacts';

/*
 * The list of entries in a suggested new section. Each entry is a row showing its title.
 * One entry at a time is open, showing its facts and bullets. When the user confirms an
 * entry's last fact, it closes and the next entry with facts to confirm opens.
 *
 * The user can leave an entry out of the section, which crosses out its row, and put it
 * back. The last remaining entry can't be left out. To leave out the whole section, the
 * user drops the suggestion.
 */

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The line under an entry's title in its row: "Code for Portland · 2021 – Present · 3 bullets". */
function describeEntry({ draft }: NewEntry): string {
  const bulletCount = draft.bullets.length;
  const bullets = bulletCount
    ? `${bulletCount} ${plural(bulletCount, 'bullet', 'bullets')}`
    : 'no bullets';
  return [draft.frame.organization, draft.frame.dates, bullets].filter(Boolean).join(' · ');
}

const readEntryName = ({ draft }: NewEntry) =>
  draft.frame.organization?.trim() || draft.frame.title?.trim() || 'Untitled entry';

/**
 * The count of facts left to confirm in the entries the user hasn't left out, with a link
 * that opens the next entry that has some.
 */
function CountLine({
  entriesNotLeftOut,
  factsLeft,
  openId,
  onOpen,
}: {
  entriesNotLeftOut: NewEntry[];
  factsLeft: EntryFactPlace[];
  openId: string | null;
  onOpen: (entryId: string) => void;
}) {
  const totalFacts = entriesNotLeftOut.reduce(
    (count, entry) => count + listWrittenFacts(entry.draft).length,
    0
  );
  const entriesWithFactsLeft = entriesNotLeftOut.filter((entry) =>
    factsLeft.some((place) => place.entryId === entry.ids.entryId)
  );
  const next = entriesWithFactsLeft.find((entry) => entry.ids.entryId !== openId);
  return (
    <div className="mb-2 flex justify-between gap-2.5">
      <Text variant="secondary" className="text-ink-soft">
        {factsLeft.length ? (
          <>
            {factsLeft.length} {plural(factsLeft.length, 'fact', 'facts')} to confirm, in{' '}
            {entriesWithFactsLeft.length} {plural(entriesWithFactsLeft.length, 'entry', 'entries')}.
            {next && (
              <>
                {' '}
                <AppButton
                  variant="link"
                  size="xs"
                  shape="text"
                  onClick={() => onOpen(next.ids.entryId)}
                  className="inline p-0"
                >
                  Next: {readEntryName(next)}
                </AppButton>
              </>
            )}
          </>
        ) : (
          'Every fact is confirmed.'
        )}
      </Text>
      <Text variant="meta" className="shrink-0 text-ink-faint">
        {totalFacts - factsLeft.length} of {totalFacts}
      </Text>
    </div>
  );
}

/** The row of an entry the user left out: its title crossed out, and a Put back link. */
function LeftOutRow({ proposal, entry }: { proposal: Proposal; entry: NewEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-1.5 pr-2.25 pl-7.25">
      <span className="flex min-w-0 flex-1 flex-col">
        <Text
          variant="body"
          className="truncate text-ink-muted line-through decoration-del decoration-[1.5px]"
        >
          {entry.draft.frame.title}
        </Text>
        <Text variant="secondary" className="truncate text-ink-muted">
          {entry.draft.frame.organization}
        </Text>
      </span>
      <CardTag>left out</CardTag>
      <AppButton
        variant="link"
        size="xs"
        shape="text"
        onClick={() => putEntryBack(proposal.id, entry.ids.entryId)}
        className="shrink-0 p-0"
      >
        Put back
      </AppButton>
    </div>
  );
}

interface EntryRowProps {
  proposal: Proposal;
  entry: NewEntry;
  factsLeftCount: number;
  isOpen: boolean;
  /** True when every other entry is left out. The last remaining entry can't be left out. */
  isOnlyEntry: boolean;
  onToggle: () => void;
  onEntryConfirmed: () => void;
  onLeaveOut: () => void;
}

/** The row of an entry the user hasn't left out. When open, it also shows the entry's facts and bullets. */
function EntryRow({
  proposal,
  entry,
  factsLeftCount,
  isOpen,
  isOnlyEntry,
  onToggle,
  onEntryConfirmed,
  onLeaveOut,
}: EntryRowProps) {
  const factCount = listWrittenFacts(entry.draft).length;
  const isJustAdded = proposal.lateIds?.includes(entry.ids.entryId) ?? false;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <div className={cn(isOpen && 'bg-add-soft shadow-[inset_2px_0_0_var(--add)]')}>
      <AppButton
        variant="plain"
        shape="text"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-none px-2.25 py-1.5',
          !isOpen && 'hover:bg-line'
        )}
      >
        <Chevron className="size-3 shrink-0 text-ink-faint" />
        <span className="flex min-w-0 flex-1 flex-col">
          <Text variant="strong" className="truncate">
            {entry.draft.frame.title}
          </Text>
          <Text variant="secondary" className="truncate text-ink-muted">
            {describeEntry(entry)}
          </Text>
        </span>
        {isJustAdded && <CardTag>just added</CardTag>}
        {factsLeftCount ? (
          <Text
            variant="meta"
            className="shrink-0 text-warn"
            title={`${factsLeftCount} ${plural(factsLeftCount, 'fact', 'facts')} to confirm`}
          >
            {factCount - factsLeftCount} of {factCount}
          </Text>
        ) : (
          <Check aria-label="Every fact confirmed" className="size-3 shrink-0 text-add" />
        )}
      </AppButton>
      {isOpen && (
        <div className="pt-0.5 pr-2.5 pb-2.5 pl-7.25">
          <FactRows
            proposal={proposal}
            entry={entry}
            onEntryConfirmed={onEntryConfirmed}
            className="bg-pane"
          />
          {entry.draft.bullets.length > 0 ? (
            <div className="mt-2.5">
              <EntryBullets proposal={proposal} entry={entry} />
            </div>
          ) : (
            <Hint>
              No bullets yet. The assistant may still add some, or you can add your own after you
              apply.
            </Hint>
          )}
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-line pt-2">
            <AppButton
              variant="link"
              size="xs"
              shape="text"
              disabled={isOnlyEntry}
              onClick={onLeaveOut}
              className="p-0"
            >
              Leave this entry out
            </AppButton>
            <Hint className="mt-0 min-w-37.5 flex-1">
              {isOnlyEntry
                ? 'This is the only entry left. To leave out the whole section, use Drop.'
                : 'The other entries stay. You can put this one back later.'}
            </Hint>
          </div>
        </div>
      )}
    </div>
  );
}

/** A suggested new section's entries: the count of facts left to confirm, then one row per entry. */
export function NewEntryStack({ proposal }: { proposal: Proposal }) {
  const { openEntryIds, openEntry } = use(SuggestionSelection);
  const entries = listNewEntries(proposal);
  const entriesNotLeftOut = entries.filter((entry) => !entry.isLeftOut);
  const factsLeft = findUnconfirmedFacts(proposal);
  const openId = readOpenEntryId(proposal, openEntryIds);
  const countFactsLeft = (entryId: string) =>
    factsLeft.filter((place) => place.entryId === entryId).length;

  const openNextAfter = (entryId: string) =>
    openEntry(proposal.id, findNextEntryToOpen(proposal, entryId));

  return (
    <>
      <CountLine
        entriesNotLeftOut={entriesNotLeftOut}
        factsLeft={factsLeft}
        openId={openId}
        onOpen={(entryId) => openEntry(proposal.id, entryId)}
      />
      <div className="flex flex-col overflow-hidden rounded-sm border border-line bg-pane-raised [&>*+*]:border-t [&>*+*]:border-line">
        {entries.map((entry) => {
          const { entryId } = entry.ids;
          if (entry.isLeftOut) {
            return <LeftOutRow key={entryId} proposal={proposal} entry={entry} />;
          }
          const isOpen = openId === entryId;
          return (
            <EntryRow
              key={entryId}
              proposal={proposal}
              entry={entry}
              factsLeftCount={countFactsLeft(entryId)}
              isOpen={isOpen}
              isOnlyEntry={entriesNotLeftOut.length === 1}
              onToggle={() => openEntry(proposal.id, isOpen ? null : entryId)}
              onEntryConfirmed={() => openNextAfter(entryId)}
              onLeaveOut={() => {
                if (leaveEntryOut(proposal.id, entryId)) openNextAfter(entryId);
              }}
            />
          );
        })}
      </div>
    </>
  );
}
