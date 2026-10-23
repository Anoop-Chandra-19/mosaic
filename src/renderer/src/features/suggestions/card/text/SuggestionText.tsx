import type { ReactNode } from 'react';
import { GAP_MARK } from '../../proposals/checks/unfilledGap';
import { diffWords } from '../../proposals/diffWords';

/*
 * A suggestion's words as the inspector shows them: what it removes struck, what it adds
 * highlighted, the words a check is about underlined, and the number gap as a field.
 */

/** Stands in for the gap while diffing, so the gap stays one token. */
const GAP_TOKEN = '⁇';

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words as whole words: a flagged "18" never underlines the "18" in "2018". */
function matchWords(words: readonly string[]): RegExp | null {
  if (!words.length) return null;
  const alternatives = words.map(escapeForRegExp).join('|');
  return new RegExp(`(?<![A-Za-z0-9])(${alternatives})(?![A-Za-z0-9])`);
}

function underline(text: string, pattern: RegExp | null, keyPrefix: string): ReactNode[] {
  if (!pattern) return [text];
  return text.split(pattern).map((part, index) =>
    index % 2 ? (
      <span
        key={`${keyPrefix}-${index}`}
        className="underline decoration-warn decoration-wavy decoration-1 underline-offset-3"
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

interface FlaggedTextProps {
  text: string;
  /** Words to underline. */
  words?: readonly string[];
  /** What stands in the text where the number goes. */
  gap?: ReactNode;
}

/** Text with the words a check is about underlined, and the gap as `gap`. */
export function FlaggedText({ text, words = [], gap }: FlaggedTextProps) {
  const pattern = matchWords(words);
  return text
    .replaceAll(GAP_TOKEN, GAP_MARK)
    .split(GAP_MARK)
    .flatMap((part, index) => [
      index > 0 && <span key={`gap-${index}`}>{gap ?? '?'}</span>,
      ...underline(part, pattern, String(index)),
    ]);
}

/** `after` against `before`: removed struck, added highlighted. Marks only, never toggles. */
export function MarkedText({
  before,
  after,
  words,
  gap,
}: Omit<FlaggedTextProps, 'text'> & { before: string; after: string }) {
  const parts = diffWords(
    before.replaceAll(GAP_MARK, GAP_TOKEN),
    after.replaceAll(GAP_MARK, GAP_TOKEN)
  );
  return parts.map((part, index) => {
    if (part.kind === 'same') {
      return <FlaggedText key={index} text={part.text} words={words} gap={gap} />;
    }
    if (part.kind === 'removed') {
      const isFollowed = parts[index + 1]?.kind === 'added' || /\s$/.test(part.text);
      return (
        <span key={index}>
          <del className="text-ink-muted decoration-del decoration-[1.5px]">
            {part.text.trim().replaceAll(GAP_TOKEN, '?')}
          </del>
          {isFollowed && ' '}
        </span>
      );
    }
    return (
      <ins
        key={index}
        className="rounded-[0.125rem] bg-add-soft px-px no-underline shadow-[inset_0_-1.5px_0_var(--add-line)]"
      >
        <FlaggedText text={part.text} words={words} gap={gap} />
      </ins>
    );
  });
}
