// Names its import's `.ts` file: the eval scripts load this with plain Node.
import { locateEveryWholeWord } from './locatePhrase.ts';

/**
 * `text` with every whole-word use of `find` changed to `replace`, as a rename does: "AWS"
 * twice in a bullet changes twice, and "Go" never touches "Google". Null when there is none.
 */
export function replaceEveryWholeWord(
  text: string,
  find: string,
  replace: string
): { text: string; isLoose: boolean } | null {
  const spans = locateEveryWholeWord(text, find);
  if (!spans.length) return null;
  let replaced = '';
  let copiedUpTo = 0;
  for (const span of spans) {
    if (span.start < copiedUpTo) continue;
    replaced += text.slice(copiedUpTo, span.start) + replace;
    copiedUpTo = span.end;
  }
  replaced += text.slice(copiedUpTo);
  return { text: replaced, isLoose: spans[0].isLoose };
}
