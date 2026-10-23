export type WordDiffKind = 'same' | 'removed' | 'added';

export interface WordDiffPart {
  kind: WordDiffKind;
  text: string;
}

type TokenOp = { op: WordDiffKind; token: string };

function splitWords(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

/** The longest common subsequence of tokens, walked into keep, remove and add steps. */
function diffTokens(before: string[], after: string[]): TokenOp[] {
  const lcs = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0)
  );
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i][j] =
        before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: TokenOp[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      ops.push({ op: 'same', token: before[i++] });
      j++;
    } else if (j < after.length && (i >= before.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      ops.push({ op: 'added', token: after[j++] });
    } else {
      ops.push({ op: 'removed', token: before[i++] });
    }
  }
  return ops;
}

/**
 * A run of kept tokens between two changes that holds at most one word reads as part of
 * one change: "Reduced latency by" → "Cut p99 latency by" is one edit, not two.
 */
function foldShortKeptRuns(ops: TokenOp[]): TokenOp[] {
  const folded: TokenOp[] = [];
  let index = 0;
  while (index < ops.length) {
    if (ops[index].op !== 'same') {
      folded.push(ops[index++]);
      continue;
    }
    let end = index;
    while (end < ops.length && ops[end].op === 'same') end++;
    const run = ops.slice(index, end);
    const isBetweenChanges = index > 0 && end < ops.length;
    const wordCount = run.filter(({ token }) => /\S/.test(token)).length;
    if (isBetweenChanges && wordCount <= 1) {
      for (const { token } of run) folded.push({ op: 'removed', token }, { op: 'added', token });
    } else {
      folded.push(...run);
    }
    index = end;
  }
  return folded;
}

/**
 * Word-level changes from `before` to `after`, spaces kept, so joining the `same` and
 * `removed` parts gives `before` and joining `same` and `added` gives `after`. Inside one
 * change the removed text comes first.
 */
export function diffWords(before: string, after: string): WordDiffPart[] {
  const ops = foldShortKeptRuns(diffTokens(splitWords(before), splitWords(after)));
  const parts: WordDiffPart[] = [];
  // Space both sides of a change end with, handed to the kept text after it.
  let carried = '';
  let index = 0;
  while (index < ops.length) {
    if (ops[index].op === 'same') {
      let text = carried;
      carried = '';
      while (index < ops.length && ops[index].op === 'same') text += ops[index++].token;
      parts.push({ kind: 'same', text });
      continue;
    }
    let removed = '';
    let added = '';
    while (index < ops.length && ops[index].op !== 'same') {
      if (ops[index].op === 'removed') removed += ops[index].token;
      else added += ops[index].token;
      index++;
    }
    const sharedSpace = removed.match(/\s+$/)?.[0];
    if (removed && added && sharedSpace && added.endsWith(sharedSpace)) {
      removed = removed.slice(0, -sharedSpace.length);
      added = added.slice(0, -sharedSpace.length);
      carried = sharedSpace;
    }
    if (removed) parts.push({ kind: 'removed', text: removed });
    if (added) parts.push({ kind: 'added', text: added });
  }
  if (carried) parts.push({ kind: 'same', text: carried });
  return parts;
}
