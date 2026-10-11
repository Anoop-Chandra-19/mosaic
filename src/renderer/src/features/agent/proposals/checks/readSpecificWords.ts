/** A word, keeping the dots and signs inside names: Node.js, C++, C#, gRPC-Web. */
const WORD = /[A-Za-z0-9][A-Za-z0-9.+#'-]*[A-Za-z0-9+#]|[A-Za-z0-9]/g;

/** What comes before a word that starts a sentence: nothing, or a sentence's end. */
const SENTENCE_START = /(?:^|[.!?:;]\s+)$/;

/** Acronyms, names with digits in them (S3, K8s), and capitalised words mid-sentence. */
function isSpecificWord(word: string, textBefore: string): boolean {
  return (
    /^[A-Z]{2,}/.test(word) ||
    /[A-Za-z]\d|\d[A-Za-z]/.test(word) ||
    (/^[A-Z]/.test(word) && !SENTENCE_START.test(textBefore))
  );
}

/** The words that carry specifics: names, places, tools and acronyms. */
export function readSpecificWords(text: string): string[] {
  return [...text.matchAll(WORD)]
    .filter((match) => isSpecificWord(match[0], text.slice(0, match.index)))
    .map((match) => match[0]);
}

/** Every word, lowercased, for asking whether a text has one. */
export function readWordSet(text: string): Set<string> {
  return new Set((text.match(WORD) ?? []).map((word) => word.toLowerCase()));
}
