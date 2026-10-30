import type { RunPart } from '@/types/agentRunView';
import { ReplyText } from '../transcript/ReplyText';
import { RunLine } from './RunLine';
import { listRunLineItems, type RunState } from './runLineItems';
import { useRunLineOpen } from './useRunLineOpen';

interface RunActivityProps {
  parts: RunPart[];
  state: RunState;
  startedAt: number;
  elapsedMs: number;
}

/**
 * What a run did and wrote: the run line, then its text. Closed, all the text is below the
 * line in order; open, what was written between steps sits among them where it happened.
 * The same element shows the run under way and the stored one, so ending moves nothing.
 */
export function RunActivity({ parts, state, startedAt, elapsedMs }: RunActivityProps) {
  const items = listRunLineItems(parts, state);
  const stepStarts = parts.flatMap((part) =>
    part.type === 'toolCall' && part.startedAt !== undefined ? [part.startedAt] : []
  );
  const { isOpen, setIsOpen } = useRunLineOpen(stepStarts, state, parts.at(-1)?.type === 'text');
  const text = isOpen && items.stepCount > 0 ? items.textOutside : items.textAll;
  const hasRows = items.rows.length > 0;
  // A caret only where text is being written: between steps, the line says what is going on.
  const isWriting = state.isRunning && (parts.length === 0 || parts.at(-1)?.type === 'text');

  return (
    <>
      {hasRows && (
        <div className="mt-2.25 first:mt-0">
          <RunLine
            items={items}
            state={state}
            startedAt={startedAt}
            elapsedMs={elapsedMs}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
          />
        </div>
      )}
      {(text.length > 0 || isWriting) && (
        <div className="mt-2.25 first:mt-0">
          <ReplyText parts={text} isWriting={isWriting} />
        </div>
      )}
    </>
  );
}
