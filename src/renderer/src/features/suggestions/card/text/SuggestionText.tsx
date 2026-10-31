import type { ReactNode } from 'react';
import { PhraseText } from '@/features/document-diff/PhraseText';
import { diffTextsAsPhrases } from '@/lib/resume/changes/diffTextsAsPhrases';
import { GAP_MARK } from '../../proposals/checks/unfilledGap';

/*
 * A suggestion's words as the inspector shows them: what it removes struck, what it adds
 * highlighted, the words a check is about underlined, and the number gap as a field.
 */

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
  const phrases = diffTextsAsPhrases(before, after).map((phrase) =>
    phrase.k === 'edit' ? { ...phrase, del: phrase.del.replaceAll(GAP_MARK, '?') } : phrase
  );
  return (
    <PhraseText
      phrases={phrases}
      side="both"
      deletedClassName="text-ink-muted line-through decoration-del decoration-[1.5px]"
      insertedClassName="rounded-[0.125rem] bg-add-soft px-px shadow-[inset_0_-1.5px_0_var(--add-line)]"
      renderWords={(text) => <FlaggedText text={text} words={words} gap={gap} />}
    />
  );
}
