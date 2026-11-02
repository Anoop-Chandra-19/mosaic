const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^ {0,3}([-*+]|\d{1,9}[.)])[ \t]/;
const INDENTED = /^[ \t]/;
const HAS_WORDS = /[\p{L}\p{N}]/u;

/** A line after a blank one that can't belong to the block before it. */
function startsNewBlock(line: string, isInList: boolean): boolean {
  if (INDENTED.test(line) || !HAS_WORDS.test(line)) return false;
  return !(isInList && LIST_ITEM.test(line));
}

/**
 * Splits a streaming reply into completed markdown blocks followed by the active block.
 * ReplyMarkdown uses these blocks to keep completed text inputs stable as more text arrives.
 * Blank lines inside fenced code or lists do not split the block. Marker-only lines stay
 * with the preceding block until text arrives. Joining the blocks reproduces the input.
 */
export function splitFinishedBlocks(text: string): string[] {
  const blocks: string[] = [];
  let blockStart = 0;
  let isInList = false;
  let isAfterBlank = false;
  let openFence: string | null = null;

  for (let lineStart = 0; lineStart < text.length;) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd);
    const fence = FENCE.exec(line)?.[1];

    if (openFence !== null) {
      if (fence?.[0] === openFence) openFence = null;
    } else if (line.trim() === '') {
      isAfterBlank = true;
    } else {
      if (isAfterBlank && startsNewBlock(line, isInList)) {
        blocks.push(text.slice(blockStart, lineStart));
        blockStart = lineStart;
        isInList = false;
      }
      if (lineStart === blockStart) isInList = LIST_ITEM.test(line);
      isAfterBlank = false;
      if (fence) openFence = fence[0];
    }
    lineStart = lineEnd + 1;
  }
  blocks.push(text.slice(blockStart));
  return blocks;
}
