import { Text } from '@/components/ui-kit';
import type { RunPart } from '@/types/agentRunView';

/** Each step's text, split at its blank lines. */
function readParagraphs(parts: RunPart[]): string[] {
  return parts
    .flatMap((part) => (part.type === 'text' ? part.text.split(/\n\s*\n/) : []))
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

/** The end of a reply still being written. */
function Caret() {
  return (
    <i
      aria-hidden
      className="ml-0.5 inline-block h-3 w-1.5 animate-caret-blink bg-amber align-[-0.125rem] motion-reduce:animate-none"
    />
  );
}

interface ReplyTextProps {
  parts: RunPart[];
  /** The run is still going: the caret marks where its text will continue. */
  isWriting?: boolean;
}

/** What the assistant wrote in a run, as paragraphs. */
export function ReplyText({ parts, isWriting = false }: ReplyTextProps) {
  const paragraphs = readParagraphs(parts);
  if (paragraphs.length === 0) {
    return isWriting ? (
      <p>
        <Caret />
      </p>
    ) : null;
  }
  return (
    <div className="space-y-1.5">
      {paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          as="p"
          variant="body"
          className="whitespace-pre-wrap [overflow-wrap:anywhere] text-pretty"
        >
          {paragraph}
          {isWriting && index === paragraphs.length - 1 && <Caret />}
        </Text>
      ))}
    </div>
  );
}
