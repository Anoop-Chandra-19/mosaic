// Keep the explicit .ts import extension: eval scripts load this module with plain Node.
import { locateEveryWholeWord } from './locatePhrase.ts';

/**
 * Replace every whole-word match of `find`: two uses of "AWS" both change, while
 * "Go" does not match "Google". Return null when there are no matches.
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
