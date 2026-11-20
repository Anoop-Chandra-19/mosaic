import { useEffect, useRef } from 'react';
import { Text } from '@/components/ui-kit';
import { formatCount } from '@/lib/formatCount';
import { KeyHint } from '../KeyHint';
import { countSuggestions } from '../suggestionState';
import { PlaceCard } from './place/PlaceCard';
import { tallyPlace, type SuggestionPlace } from './place/placeSuggestions';
import type { PlaceViewProps } from './place/PlaceSuggestion';

/** How the left side shows the suggestions, which the list's hint speaks to. */
export type ReviewMode = 'page' | 'cards' | 'preview';

interface ReviewInspectorProps {
  places: SuggestionPlace[];
  mode: ReviewMode;
  isPlaceFolded: (place: SuggestionPlace) => boolean;
  onFoldedChange: (key: string, isFolded: boolean) => void;
  view: PlaceViewProps;
}

const LIST_HINTS: Record<ReviewMode, string> = {
  page: 'Click a mark on the page or a suggestion here. Only that one opens.',
  cards: 'Every suggestion is open on the left. Pick one here to go to it.',
  preview: 'Pick one to read it. Keeping or dropping changes the preview at once.',
};

/**
 * The right-hand column: a card for each place on the page that has suggestions, in page
 * order. The selected suggestion opens inside its card.
 */
export function ReviewInspector({
  places,
  mode,
  isPlaceFolded,
  onFoldedChange,
  view,
}: ReviewInspectorProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { selectedId } = view;
  const proposals = places.flatMap((place) => place.proposals);
  const { kept, toCheck } = tallyPlace(proposals);
  const { stale } = countSuggestions(proposals);
  const notes = [toCheck > 0 && `${toCheck} to look at`, stale > 0 && `${stale} out of date`];
  const note = notes.filter(Boolean).join(', ');

  // The selected suggestion comes into view, whether it was picked here, on the page, or with the keys.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector(`[data-suggestion-row="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <>
      <div className="border-b border-line px-4 pt-4.5 pb-3.5 text-center">
        <Text as="p" variant="strong" className="mb-0.75">
          {formatCount(proposals.length, 'suggestion')} in {formatCount(places.length, 'place')} on
          your resume
        </Text>
        <Text as="p" variant="secondary" className="text-pretty text-ink-muted">
          {kept} kept. {LIST_HINTS[mode]}
          {note && ` ${note}.`}
        </Text>
      </div>
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3 pb-7.5"
      >
        {places.map((place) => (
          <PlaceCard
            key={place.key}
            place={place}
            isFolded={isPlaceFolded(place)}
            onFoldedChange={(isFolded) => onFoldedChange(place.key, isFolded)}
            view={view}
          />
        ))}
      </div>
      <Text
        as="p"
        variant="meta"
        className="flex shrink-0 flex-wrap items-center gap-1 border-t border-line px-3 py-2 text-ink-muted"
      >
        <KeyHint id="nextSuggestion" />/<KeyHint id="previousSuggestion" /> next suggestion, down
        the page · <KeyHint id="keepSuggestion" /> keep · <KeyHint id="dropSuggestion" /> drop ·{' '}
        <KeyHint id="editSuggestion" /> edit
      </Text>
    </>
  );
}
