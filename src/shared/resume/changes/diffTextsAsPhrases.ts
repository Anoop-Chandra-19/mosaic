import type { TextPhrase } from './changePhrases';

type Step = { op: 'same' | 'del' | 'ins'; token: string };

function alignWords(before: string[], after: string[]): Step[] {
  const n = before.length;
  const m = after.length;
  // kept[i * (m + 1) + j]: the longest common run of before[i..] and after[j..].
  const kept = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      kept[at(i, j)] =
        before[i] === after[j]
          ? kept[at(i + 1, j + 1)] + 1
          : Math.max(kept[at(i + 1, j)], kept[at(i, j + 1)]);
    }
  }
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      steps.push({ op: 'same', token: before[i] });
      i++;
      j++;
    } else if (kept[at(i + 1, j)] >= kept[at(i, j + 1)]) {
      steps.push({ op: 'del', token: before[i++] });
    } else {
      steps.push({ op: 'ins', token: after[j++] });
    }
  }
  while (i < n) steps.push({ op: 'del', token: before[i++] });
  while (j < m) steps.push({ op: 'ins', token: after[j++] });
  return steps;
}

const toWords = (text: string) => text.split(/(\s+)/).filter(Boolean);

/** A lone space between two edits joins them, so "a b" → "c d" reads as one swap, not two. */
export function diffTextsAsPhrases(before: string, after: string, idPrefix = 'w'): TextPhrase[] {
  const steps = alignWords(toWords(before), toWords(after));
  const phrases: TextPhrase[] = [];
  let del = '';
  let ins = '';
  let edits = 0;
  const flush = () => {
    if (del || ins) phrases.push({ k: 'edit', id: `${idPrefix}${edits++}`, del, ins });
    del = '';
    ins = '';
  };
  steps.forEach((step, index) => {
    const isBridge =
      step.op === 'same' &&
      /^\s+$/.test(step.token) &&
      index > 0 &&
      index < steps.length - 1 &&
      steps[index - 1].op !== 'same' &&
      steps[index + 1].op !== 'same';
    if (isBridge) {
      del += step.token;
      ins += step.token;
    } else if (step.op === 'same') {
      flush();
      const last = phrases.at(-1);
      if (last?.k === 'keep') last.t += step.token;
      else phrases.push({ k: 'keep', t: step.token });
    } else if (step.op === 'del') {
      del += step.token;
    } else {
      ins += step.token;
    }
  });
  flush();
  return phrases;
}
