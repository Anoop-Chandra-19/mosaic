import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { formatCount } from '@/lib/formatCount';
import { cn } from '@/lib/utils';
import { KeepEasyButton } from './KeepEasyButton';
import { formatPlaceTally, tallyPlace, type SuggestionPlace } from './placeSuggestions';
import { PlaceSuggestion, type PlaceViewProps } from './PlaceSuggestion';

interface PlaceCardProps {
  place: SuggestionPlace;
  isFolded: boolean;
  onFoldedChange: (isFolded: boolean) => void;
  view: PlaceViewProps;
}

/**
 * One place in the inspector: its name, a row for each of its suggestions, and a footer
 * with the tally and Keep all. Only the selected suggestion is open. Folded, the card is
 * just its header, with the tally.
 */
export function PlaceCard({ place, isFolded, onFoldedChange, view }: PlaceCardProps) {
  const { proposals } = place;
  const hasSelected = proposals.some((proposal) => proposal.id === view.selectedId);
  const tally = tallyPlace(proposals);
  // An entry's card names its section too; in the inspector there is no heading above it.
  const detail = [place.detail, place.sectionLabel].filter(Boolean).join(' · ');
  const FoldIcon = isFolded ? ChevronRight : ChevronDown;
  return (
    <section
      aria-label={place.title}
      className={cn(
        'shrink-0 overflow-hidden rounded-lg border border-line bg-pane transition-[border-color,box-shadow] duration-140',
        hasSelected && 'border-ink-muted ring-3 ring-line-strong'
      )}
    >
      <AppButton
        variant="ghost"
        shape="text"
        aria-expanded={!isFolded}
        title={isFolded ? 'Show its suggestions' : 'Fold it to one line'}
        onClick={() => onFoldedChange(!isFolded)}
        className={cn(
          'flex w-full items-center gap-2 rounded-none bg-pane-raised px-2.75 py-2',
          !isFolded && 'border-b border-line'
        )}
      >
        <FoldIcon className="size-3 shrink-0 text-ink-faint" />
        <span className="flex min-w-0 flex-1 flex-col">
          <Text variant="strong" className="truncate">
            {place.title}
          </Text>
          {detail && (
            <Text variant="caption" className="truncate text-ink-muted">
              {detail}
            </Text>
          )}
        </span>
        <Text variant="secondary" className="shrink-0 whitespace-nowrap text-ink-muted">
          {isFolded ? formatPlaceTally(tally) : formatCount(proposals.length, 'suggestion')}
        </Text>
      </AppButton>
      {!isFolded && (
        <>
          <div className="flex flex-col divide-y divide-line">
            {proposals.map((proposal) => (
              <PlaceSuggestion
                key={proposal.id}
                proposal={proposal}
                look="card"
                isOpen={proposal.id === view.selectedId}
                view={view}
              />
            ))}
          </div>
          {proposals.length > 1 && (
            <div className="flex items-center gap-2 border-t border-line bg-pane-raised px-2.75 py-1.75">
              <Text variant="secondary" className="min-w-0 flex-1 text-ink-muted">
                {formatPlaceTally(tally)}
                {tally.toCheck > 0 && ` · ${tally.toCheck} to look at`}
              </Text>
              <KeepEasyButton proposals={proposals} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
