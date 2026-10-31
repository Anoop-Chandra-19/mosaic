import { Move } from 'lucide-react';
import { Chip, Text } from '@/components/ui-kit';
import { findMoves } from '@/lib/resume/changes/findMoves';
import { cn } from '@/lib/utils';
import type { ProposalChange } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { findEntry, findSection } from '../../proposals/proposalAnchor';
import { nameEntry } from '../text/suggestionWords';
import { Caption } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';

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

export function ReorderBody({ proposal, draft }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'reorder') return null;
  const moved = findMoves(change.before, change.after).map(({ id }) => id);
  return (
    <>
      <Caption>Suggested order</Caption>
      <div className="flex flex-col gap-1.5">
        {change.after.map((id, index) => {
          const from = change.before.indexOf(id) + 1;
          const isMoved = moved.includes(id);
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
