/**
 * The checks the evals apply to a model's proposal. Failures carry the `fix` hint the model
 * gets back in its one repair round.
 */

export type ProposalCheck =
  | { ok: true; result: string; editCount: number }
  | { ok: false; code: string; fix: string };

type Segment = { type: 'keep'; text: string } | { type: 'edit'; del: string; ins: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/** Some models send an array argument as a JSON string. */
function readArray(value: unknown): unknown[] | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return Array.isArray(value) ? value : null;
}

function isSegment(value: unknown): value is Segment {
  const s = asRecord(value);
  return (
    (s.type === 'keep' && typeof s.text === 'string') ||
    (s.type === 'edit' && typeof s.del === 'string' && typeof s.ins === 'string')
  );
}

export function checkSegmentsProposal(
  original: string,
  bulletId: string,
  args: unknown
): ProposalCheck {
  const { bulletId: id, segments } = asRecord(args);
  if (id !== bulletId)
    return { ok: false, code: 'wrong-id', fix: `bulletId must be "${bulletId}".` };
  const list = readArray(segments);
  if (!list || list.length === 0) {
    return { ok: false, code: 'shape', fix: 'segments must be a non-empty array.' };
  }
  if (!list.every(isSegment)) {
    return {
      ok: false,
      code: 'shape',
      fix: 'Each segment is {type:"keep",text} or {type:"edit",del,ins}, with strings.',
    };
  }
  const rebuilt = list.map((s) => (s.type === 'keep' ? s.text : s.del)).join('');
  if (rebuilt !== original) {
    return {
      ok: false,
      code: 'reconstruct',
      fix: `Concatenating keep.text and edit.del gives:\n${JSON.stringify(rebuilt)}\nbut the original is:\n${JSON.stringify(original)}\nWalk the original from start to end and cover every character exactly once.`,
    };
  }
  const edits = list.filter((s) => s.type === 'edit' && s.del !== s.ins);
  if (edits.length === 0) return { ok: false, code: 'no-edit', fix: 'Make at least one edit.' };
  if (edits.length > 3) {
    return {
      ok: false,
      code: 'too-many',
      fix: `You made ${edits.length} edits; merge them into at most 3.`,
    };
  }
  if (list.some((s, i) => i > 0 && s.type === 'edit' && list[i - 1].type === 'edit')) {
    return {
      ok: false,
      code: 'adjacent',
      fix: 'Two edits touch; merge them into one edit, or leave original text between them.',
    };
  }
  const result = list.map((s) => (s.type === 'keep' ? s.text : s.ins)).join('');
  return { ok: true, result, editCount: edits.length };
}

const loosenPhrase = (text: string) =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ');

/**
 * Where `find` sits in `text`: exact first, then forgiving of curly quotes, dashes, and runs
 * of spaces. Loosening replaces characters one for one or collapses spaces, so indexes line up
 * with the original for text written with single spaces, which is all a bullet holds.
 */
export function locatePhrase(
  text: string,
  find: string
): { start: number; end: number; isLoose: boolean } | 'none' | 'many' {
  const first = text.indexOf(find);
  if (first !== -1) {
    return text.indexOf(find, first + 1) === -1
      ? { start: first, end: first + find.length, isLoose: false }
      : 'many';
  }
  const looseText = loosenPhrase(text);
  const looseFind = loosenPhrase(find);
  const at = looseText.indexOf(looseFind);
  if (at === -1) return 'none';
  if (looseText.indexOf(looseFind, at + 1) !== -1) return 'many';
  return { start: at, end: at + looseFind.length, isLoose: true };
}

export function checkEditsProposal(
  original: string,
  bulletId: string,
  args: unknown
): ProposalCheck {
  const { bulletId: id, edits } = asRecord(args);
  if (id !== bulletId)
    return { ok: false, code: 'wrong-id', fix: `bulletId must be "${bulletId}".` };
  const list = readArray(edits);
  if (!list || list.length === 0) {
    return { ok: false, code: 'shape', fix: 'edits must be a non-empty array of {find, replace}.' };
  }
  if (list.length > 3) {
    return {
      ok: false,
      code: 'too-many',
      fix: `You made ${list.length} edits; merge them into at most 3.`,
    };
  }
  const spans: { start: number; end: number; replace: string }[] = [];
  for (const item of list) {
    const { find, replace } = asRecord(item);
    if (typeof find !== 'string' || typeof replace !== 'string' || find === '') {
      return {
        ok: false,
        code: 'shape',
        fix: 'Each edit is {find, replace}, both strings, find not empty.',
      };
    }
    if (find === replace) {
      return {
        ok: false,
        code: 'no-op',
        fix: `The edit for ${JSON.stringify(find)} changes nothing; drop it.`,
      };
    }
    const at = locatePhrase(original, find);
    if (at === 'none') {
      return {
        ok: false,
        code: 'not-found',
        fix: `${JSON.stringify(find)} is not in the original bullet. Copy find exactly from:\n${JSON.stringify(original)}`,
      };
    }
    if (at === 'many') {
      return {
        ok: false,
        code: 'not-unique',
        fix: `${JSON.stringify(find)} appears more than once; include more surrounding words.`,
      };
    }
    spans.push({ start: at.start, end: at.end, replace });
  }
  spans.sort((a, b) => a.start - b.start);
  if (spans.some((span, i) => i > 0 && span.start <= spans[i - 1].end)) {
    return {
      ok: false,
      code: 'overlap',
      fix: 'Two edits overlap or touch; merge them into one edit.',
    };
  }
  let result = '';
  let at = 0;
  for (const span of spans) {
    result += original.slice(at, span.start) + span.replace;
    at = span.end;
  }
  result += original.slice(at);
  return { ok: true, result, editCount: spans.length };
}

/**
 * How many separate changes a reviewer would see between two bullets: a word diff where a
 * single kept word or space between two changes is read as part of one change.
 */
export function countWordDiffHunks(before: string, after: string): number {
  const a = before.match(/\s+|[^\s]+/g) ?? [];
  const b = after.match(/\s+|[^\s]+/g) ?? [];
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  let ops = '';
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops += 'k';
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      ops += 'x';
      j++;
    } else {
      ops += 'x';
      i++;
    }
  }
  const merged = ops.replace(/x(k{1,2})x/g, (run) => 'x'.repeat(run.length));
  return (merged.match(/x+/g) ?? []).length;
}

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  twenty: '20',
  thirty: '30',
  forty: '40',
  hundred: '100',
};
const NUMBER_WORD = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'g');

function readNumbers(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(NUMBER_WORD, (word) => NUMBER_WORDS[word])
    .replace(/\be2e\b/g, 'end-to-end');
  return new Set(normalized.match(/\d+(?:[.,]\d+)?/g) ?? []);
}

/** Numbers in the rewrite that the original does not have, words and digits counted alike. */
export function findNewNumbers(original: string, rewritten: string): string[] {
  const had = readNumbers(original);
  return [...readNumbers(rewritten)].filter((n) => !had.has(n));
}

const SUPPORTING_ROLE =
  /\b(assisted|helped|participated|contributed|supported|was part of|part of the team|worked with|worked on|collaborated)\b/i;
const LEADING_ROLE =
  /\b(led|owned|spearheaded|drove|headed|directed|managed|architected|rewrote|built|designed|launched|delivered)\b/i;

/** A supporting role in the original turned into a leading one in the rewrite. */
export function claimsMoreThanOriginal(original: string, rewritten: string): boolean {
  return (
    SUPPORTING_ROLE.test(original) &&
    !SUPPORTING_ROLE.test(rewritten) &&
    LEADING_ROLE.test(rewritten) &&
    !LEADING_ROLE.test(original)
  );
}
