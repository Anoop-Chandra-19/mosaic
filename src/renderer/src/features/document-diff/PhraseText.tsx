import { Fragment, type ReactNode } from 'react';
import type { TextPhrase } from '@/lib/resume/changes/resumeChange';
import { DIFF_MARKS } from './diffMarks';

interface PhraseTextProps {
  phrases: TextPhrase[];
  /** The text before, the text after, or both: the old words, then the new. */
  side: 'before' | 'after' | 'both';
  /** How kept and inserted words are drawn, for a view that adds to them. */
  renderWords?: (text: string) => ReactNode;
}

/** The space around deleted words stays out of the mark: it isn't what was deleted. */
function DeletedWords({ text }: { text: string }) {
  const words = text.trim();
  if (!words) return text;
  const start = text.indexOf(words);
  return (
    <>
      {text.slice(0, start)}
      <del className={DIFF_MARKS.removed}>{words}</del>
      {text.slice(start + words.length)}
    </>
  );
}

/** An edit's text with its changed words marked. */
export function PhraseText({ phrases, side, renderWords = (text) => text }: PhraseTextProps) {
  return phrases.map((phrase, index) => {
    if (phrase.k === 'keep') return <Fragment key={index}>{renderWords(phrase.t)}</Fragment>;
    const needsSpace = side === 'both' && phrase.del && phrase.ins && !/\s$/.test(phrase.del);
    return (
      <Fragment key={index}>
        {side !== 'after' && phrase.del && <DeletedWords text={phrase.del} />}
        {needsSpace && ' '}
        {side !== 'before' && phrase.ins && (
          <ins className={DIFF_MARKS.added}>{renderWords(phrase.ins)}</ins>
        )}
      </Fragment>
    );
  });
}
