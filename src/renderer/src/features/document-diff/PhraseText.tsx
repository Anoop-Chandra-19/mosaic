import { Fragment } from 'react';
import type { TextPhrase } from '@shared/resume/changes/resumeChange';

interface PhraseTextProps {
  phrases: TextPhrase[];
  /** The text before, the text after, or both: the old words, then the new. */
  side: 'before' | 'after' | 'both';
  deletedClassName?: string;
  insertedClassName?: string;
}

/** An edit's text with its changed words marked; each view says how. */
export function PhraseText({
  phrases,
  side,
  deletedClassName,
  insertedClassName,
}: PhraseTextProps) {
  return phrases.map((phrase, index) => {
    if (phrase.k === 'keep') return <Fragment key={index}>{phrase.t}</Fragment>;
    return (
      <Fragment key={index}>
        {side !== 'after' && phrase.del && <span className={deletedClassName}>{phrase.del}</span>}
        {side !== 'before' && phrase.ins && <span className={insertedClassName}>{phrase.ins}</span>}
      </Fragment>
    );
  });
}
