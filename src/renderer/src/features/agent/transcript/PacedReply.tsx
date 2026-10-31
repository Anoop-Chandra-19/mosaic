import { ReplyMarkdown } from './ReplyMarkdown';
import { usePacedText } from './usePacedText';

interface PacedReplyProps {
  text: string;
  isWriting: boolean;
}

/** A reply at a steady pace. The caret stays until the words shown have caught up. */
export function PacedReply({ text, isWriting }: PacedReplyProps) {
  const shown = usePacedText(text);
  return <ReplyMarkdown text={shown} isWriting={isWriting || shown !== text} />;
}
