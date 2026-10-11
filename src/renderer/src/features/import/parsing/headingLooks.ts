import { isCapitals, sourceOf, titleCase, type ImportLine } from './importLines';

/** A line as a reader holds it: `look` is how it is set, to compare with other lines. */
export interface SetLine {
  line: ImportLine;
  look: string;
}

/**
 * Which looks a file sets its section headings in: the look of its known headings ("Work
 * History"), when lines set that way that are something else don't outnumber them. Each
 * reader decides which lines `couldHead` and which are `isKnown`; the vote is the same.
 */
export function findHeadingLooks<T extends SetLine>(
  lines: T[],
  couldHead: (line: T) => boolean,
  isKnown: (line: T) => boolean
): (look: string) => boolean {
  const tally = new Map<string, { known: number; other: number }>();
  for (const line of lines) {
    if (!couldHead(line)) continue;
    const count = tally.get(line.look) ?? { known: 0, other: 0 };
    count[isKnown(line) ? 'known' : 'other']++;
    tally.set(line.look, count);
  }
  return (look) => {
    const count = tally.get(look);
    return count !== undefined && count.known > 0 && count.known >= count.other;
  };
}

/** A heading in capitals reads in title case; its source keeps the file's own text. */
export function markHeading(line: ImportLine): void {
  line.role = 'heading';
  if (isCapitals(line.text)) {
    line.source = sourceOf(line);
    line.text = titleCase(line.text);
  }
}
