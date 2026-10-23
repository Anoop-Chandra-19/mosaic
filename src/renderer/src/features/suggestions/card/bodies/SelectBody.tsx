import { Eye, EyeOff } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { BlockBody } from './BlockBody';
import { Caption, TagLine } from './BodyParts';
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
      <Text
        as="p"
        variant="body"
        className={cn(!change.selected && 'text-ink-muted line-through decoration-del')}
      >
        {change.before}
      </Text>
      <TagLine icon={change.selected ? Eye : EyeOff}>
        {change.selected
          ? 'Back on the page.'
          : 'Off the page, still in your content. Show it again from the editor any time.'}
      </TagLine>
    </>
  );
}
