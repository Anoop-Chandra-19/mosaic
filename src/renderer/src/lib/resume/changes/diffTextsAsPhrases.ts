import type { TextPhrase } from './resumeChange';
import { measureCommonRuns } from './measureCommonRuns';

type Step = { op: 'same' | 'del' | 'ins'; token: string };

function alignWords(before: string[], after: string[]): Step[] {
  const runFrom = measureCommonRuns(before, after);
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      steps.push({ op: 'same', token: before[i] });
      i++;
      j++;
    } else if (runFrom(i + 1, j) >= runFrom(i, j + 1)) {
      steps.push({ op: 'del', token: before[i++] });
    } else {
      steps.push({ op: 'ins', token: after[j++] });
    }
  }
  while (i < before.length) steps.push({ op: 'del', token: before[i++] });
  while (j < after.length) steps.push({ op: 'ins', token: after[j++] });
  return steps;
}

/**
 * A run of kept tokens between two edits that holds at most one word reads as part of one
 * edit: "Reduced latency by" → "Cut p99 latency by" is one swap, not two.
 */
function foldShortKeptRuns(steps: Step[]): Step[] {
  const folded: Step[] = [];
  let index = 0;
  while (index < steps.length) {
    if (steps[index].op !== 'same') {
      folded.push(steps[index++]);
      continue;
    }
    let end = index;
    while (end < steps.length && steps[end].op === 'same') end++;
    const run = steps.slice(index, end);
    const isBetweenEdits = index > 0 && end < steps.length;
    const wordCount = run.filter(({ token }) => /\S/.test(token)).length;
    if (isBetweenEdits && wordCount <= 1) {
      for (const { token } of run) folded.push({ op: 'del', token }, { op: 'ins', token });
    } else {
      folded.push(...run);
    }
    index = end;
  }
  return folded;
}

function addKept(phrases: TextPhrase[], text: string) {
  const last = phrases.at(-1);
  if (last?.k === 'keep') last.t += text;
  else phrases.push({ k: 'keep', t: text });
}

/** Space both sides of an edit end with isn't part of it, so it goes to the kept text after. */
function addEdit(phrases: TextPhrase[], del: string, ins: string) {
  const sharedSpace = del.match(/\s+$/)?.[0];
  if (sharedSpace && ins.endsWith(sharedSpace)) {
    phrases.push({
      k: 'edit',
      del: del.slice(0, -sharedSpace.length),
      ins: ins.slice(0, -sharedSpace.length),
    });
    addKept(phrases, sharedSpace);
  } else {
    phrases.push({ k: 'edit', del, ins });
  }
}

const toWords = (text: string) => text.split(/(\s+)/).filter(Boolean);

/**
 * The one word diff: what `before` and `after` keep, and what each edit swaps. Spaces are kept,
 * so the keeps and dels join into `before`, and the keeps and inses into `after`.
 */
export function diffTextsAsPhrases(before: string, after: string): TextPhrase[] {
  const steps = foldShortKeptRuns(alignWords(toWords(before), toWords(after)));
  const phrases: TextPhrase[] = [];
  let del = '';
  let ins = '';
  for (const { op, token } of steps) {
    if (op === 'del') {
      del += token;
    } else if (op === 'ins') {
      ins += token;
    } else {
      if (del || ins) addEdit(phrases, del, ins);
      del = '';
      ins = '';
      addKept(phrases, token);
    }
  }
  if (del || ins) addEdit(phrases, del, ins);
  return phrases;
}
