const listWords = (text: string) => text.match(/\S+/g) ?? [];

/** Whether two texts differ only in their spaces: no word removed or added. */
export function hasSameWords(before: string, after: string): boolean {
  const wordsAfter = listWords(after);
  const wordsBefore = listWords(before);
  return (
    wordsBefore.length === wordsAfter.length &&
    wordsBefore.every((word, index) => word === wordsAfter[index])
  );
}
