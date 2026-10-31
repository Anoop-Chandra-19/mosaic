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

/** The space around changed words stays out of their mark: it isn't what changed. */
function MarkedWords({ text, mark }: { text: string; mark: (words: string) => ReactNode }) {
  const words = text.trim();
  if (!words) return text;
  const start = text.indexOf(words);
  return (
    <>
      {text.slice(0, start)}
      {mark(words)}
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
        {side !== 'after' && phrase.del && (
          <MarkedWords
            text={phrase.del}
            mark={(words) => <del className={DIFF_MARKS.removed}>{words}</del>}
          />
        )}
        {needsSpace && ' '}
        {side !== 'before' && phrase.ins && (
          <MarkedWords
            text={phrase.ins}
            mark={(words) => <ins className={DIFF_MARKS.added}>{renderWords(words)}</ins>}
          />
        )}
      </Fragment>
    );
  });
}
