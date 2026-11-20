import { useEffect, useRef } from 'react';
import { AppButton, Text } from '@/components/ui-kit';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import { KeepEasyButton } from './KeepEasyButton';
import { formatPlaceTally, isDecided, tallyPlace, type SuggestionPlace } from './placeSuggestions';
import { PlaceSuggestion, type PlaceViewProps } from './PlaceSuggestion';

interface SuggestionDocumentProps {
  places: SuggestionPlace[];
  isPlaceFolded: (place: SuggestionPlace) => boolean;
  onFoldedChange: (key: string, isFolded: boolean) => void;
  view: PlaceViewProps;
}

/**
 * Compare all: every suggestion open, read as a document. Each place is a heading that
 * stays at the top while its suggestions scroll under it. The place with the selected
 * suggestion is shaded, and the selected suggestion is shaded more, with a dark bar on its
 * left. A suggestion the user has decided shrinks to one line unless it is selected.
 */
export function SuggestionDocument({
  places,
  onFoldedChange,
  isPlaceFolded,
  view,
}: SuggestionDocumentProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const { selectedId } = view;

  // The selected suggestion comes into view, below the heading that stays at the top.
  useEffect(() => {
    if (!selectedId) return;
    documentRef.current
      ?.querySelector(`[data-suggestion-row="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <div
      ref={documentRef}
      className={cn(
        'min-h-0 min-w-0 overflow-auto overscroll-contain border-r border-line bg-pane-sunken px-8 pt-2 pb-19 [&_[data-suggestion-row]]:scroll-mt-18',
        // The page slides out for the document and back, the way the toggle runs.
        transitionClasses({ name: 'page', motion: 'handoff step' })
      )}
    >
      {places.map((place, index) => {
        const previous = places[index - 1];
        // An entry's section is named once, above the first of its entries.
        const isFirstInSection =
          place.sectionLabel !== undefined && previous?.sectionLabel !== place.sectionLabel;
        return (
          <PlaceSection
            key={place.key}
            place={place}
            sectionLabel={isFirstInSection ? place.sectionLabel : undefined}
            isFolded={isPlaceFolded(place)}
            onFoldedChange={(isFolded) => onFoldedChange(place.key, isFolded)}
            view={view}
          />
        );
      })}
    </div>
  );
}

interface PlaceSectionProps {
  place: SuggestionPlace;
  /** Set on the first entry of a section, to name the section above it. */
  sectionLabel: string | undefined;
  isFolded: boolean;
  onFoldedChange: (isFolded: boolean) => void;
  view: PlaceViewProps;
}

function PlaceSection({ place, sectionLabel, isFolded, onFoldedChange, view }: PlaceSectionProps) {
  const { proposals } = place;
  const isCurrent = proposals.some((proposal) => proposal.id === view.selectedId);
  const tally = tallyPlace(proposals);
  return (
    <>
      {sectionLabel && (
        <Text as="p" variant="tag" className="mx-auto mt-6 mb-1 max-w-180 px-4">
          {sectionLabel}
        </Text>
      )}
      <section
        aria-label={place.title}
        className={cn(
          'mx-auto mb-2.5 max-w-180 rounded-lg px-4 pb-1 transition-[background-color] duration-140',
          isCurrent && 'bg-pane ring-1 ring-line'
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-2 flex items-center gap-2.5 border-b pt-4 pb-2',
            isCurrent ? 'bg-pane' : 'bg-pane-sunken',
            isFolded ? 'border-line' : 'border-line-strong'
          )}
        >
          <AppButton
            variant="plain"
            shape="text"
            aria-expanded={!isFolded}
            title={isFolded ? 'Show its suggestions' : 'Fold it to one line'}
            onClick={() => onFoldedChange(!isFolded)}
            className="group/heading flex min-w-0 flex-1 items-baseline justify-start gap-2.5 p-0"
          >
            <Text
              variant="title"
              className={cn(
                'truncate underline-offset-3 group-hover/heading:underline group-hover/heading:decoration-line-heavy',
                !isCurrent && 'text-ink-soft'
              )}
            >
              {place.title}
            </Text>
            {place.detail && (
              <Text variant="secondary" className="truncate text-ink-muted">
                {place.detail}
              </Text>
            )}
          </AppButton>
          <Text variant="secondary" className="shrink-0 whitespace-nowrap text-ink-muted">
            {formatPlaceTally(tally)}
            {tally.toCheck > 0 && ` · ${tally.toCheck} to look at`}
          </Text>
          {!isFolded && <KeepEasyButton proposals={proposals} />}
        </header>
        {!isFolded && (
          <div className="-mx-4 flex flex-col divide-y divide-line">
            {proposals.map((proposal) => (
              <PlaceSuggestion
                key={proposal.id}
                proposal={proposal}
                look="document"
                isOpen={proposal.id === view.selectedId || !isDecided(proposal)}
                view={view}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
