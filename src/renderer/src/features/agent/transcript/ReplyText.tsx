import type { RunPart } from '@/types/agentRunView';
import { ReplyMarkdown } from './ReplyMarkdown';

interface ReplyTextProps {
  parts: RunPart[];
  /** The run is still going: the caret marks where its text will continue. */
  isWriting?: boolean;
}

/**
 * What the assistant wrote in a run, a block for each step's text. Only the newest block
 * changes as it streams, so the finished ones above it aren't drawn again.
 */
export function ReplyText({ parts, isWriting = false }: ReplyTextProps) {
  const texts = parts.flatMap((part) => (part.type === 'text' ? [part.text] : []));
  if (texts.length === 0) return isWriting ? <ReplyMarkdown text="" isWriting /> : null;
  return (
    <div className="space-y-1.5">
      {texts.map((text, index) => (
        <ReplyMarkdown
          key={index}
          text={text}
          isWriting={isWriting && index === texts.length - 1}
        />
      ))}
    </div>
  );
}
