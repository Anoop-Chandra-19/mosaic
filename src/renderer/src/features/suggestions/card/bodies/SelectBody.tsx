import { Eye, EyeOff } from 'lucide-react';
import { DIFF_MARKS } from '@/features/document-diff/diffMarks';
import { cn } from '@/lib/utils';
import { BlockBody } from './BlockBody';
import { Caption, SuggestedText, TagLine } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';

export function SelectBody(props: SuggestionBodyProps) {
  const { change } = props.proposal;
  if (change.kind !== 'select') return null;
  if (change.place.unit === 'entry' || change.place.unit === 'section') {
    return <BlockBody {...props} />;
  }
  return (
    <>
      <Caption>Suggested</Caption>
      <SuggestedText className={cn(!change.selected && DIFF_MARKS.app.removed)}>
        {change.before}
      </SuggestedText>
      <TagLine icon={change.selected ? Eye : EyeOff}>
        {change.selected
          ? 'Back on the page.'
          : 'Off the page, still in your content. Show it again from the editor any time.'}
      </TagLine>
    </>
  );
}
