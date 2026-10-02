import type { TextPhrase } from './changePhrases';
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
