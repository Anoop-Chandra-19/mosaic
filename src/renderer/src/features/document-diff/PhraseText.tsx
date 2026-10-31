import { Fragment, type ReactNode } from 'react';
import type { TextPhrase } from '@/lib/resume/changes/resumeChange';
import { DIFF_MARKS, type DiffInk } from './diffMarks';

interface PhraseTextProps {
  phrases: TextPhrase[];
  /** The text before, the text after, or both: the old words, then the new. */
  side: 'before' | 'after' | 'both';
  ink?: DiffInk;
  /** How kept and inserted words are drawn, for a view that adds to them. */
  renderWords?: (text: string) => ReactNode;
}

/** The space around deleted words stays out of the mark: it isn't what was deleted. */
function DeletedWords({ text, ink }: { text: string; ink: DiffInk }) {
  const words = text.trim();
  if (!words) return text;
  const start = text.indexOf(words);
  return (
    <>
      {text.slice(0, start)}
      <del className={DIFF_MARKS[ink].removed}>{words}</del>
      {text.slice(start + words.length)}
    </>
  );
}

/** An edit's text with its changed words marked. */
export function PhraseText({
  phrases,
  side,
  ink = 'app',
  renderWords = (text) => text,
}: PhraseTextProps) {
  return phrases.map((phrase, index) => {
    if (phrase.k === 'keep') return <Fragment key={index}>{renderWords(phrase.t)}</Fragment>;
    const needsSpace = side === 'both' && phrase.del && phrase.ins && !/\s$/.test(phrase.del);
    return (
      <Fragment key={index}>
        {side !== 'after' && phrase.del && <DeletedWords text={phrase.del} ink={ink} />}
        {needsSpace && ' '}
        {side !== 'before' && phrase.ins && (
          <ins className={DIFF_MARKS[ink].added}>{renderWords(phrase.ins)}</ins>
        )}
      </Fragment>
    );
  });
}
