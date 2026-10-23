import { Text } from '@/components/ui-kit';
import { Caption, CaptionTag, Lines } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';

export function SplitBody({ proposal }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'split') return null;
  const parts = [change.before.slice(0, change.at), change.before.slice(change.at)];
  return (
    <>
      <Caption>Now, one bullet</Caption>
      <Text as="p" variant="secondary" className="text-ink-soft">
        {parts[0]}
        <span
          title="Splits here"
          className="mx-0.75 -mb-0.5 inline-block h-3.5 w-0.5 rounded-[0.0625rem] bg-amber"
        />
        {parts[1]}
      </Text>
      <Caption>
        Suggested, two bullets <CaptionTag>same words</CaptionTag>
      </Caption>
      <div>
        <Lines isNumbered variant="body" lines={parts.map((part) => part.trim())} />
      </div>
    </>
  );
}
