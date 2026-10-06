import type { ProposalFlag } from '@shared/types/agentProposal';
import { readNumbers } from './readNumbers';

/** What a number could have been worked out from, given two numbers the text already had. */
const DERIVATIONS: ((a: number, b: number) => number)[] = [
  (a, b) => a + b,
  (a, b) => a - b,
  (a, b) => a * b,
  (a, b) => a / b,
  (a, b) => ((a - b) / a) * 100,
  (a, b) => (b / a) * 100,
];

/** 18% → 3% gives 83%: a calculation the model did, to check, not a fact it made up. */
function isCalculated(value: number, known: number[]): boolean {
  return known.some((a, i) =>
    known.some(
      (b, j) =>
        i !== j &&
        DERIVATIONS.some((derive) => {
          const result = derive(a, b);
          return Number.isFinite(result) && Math.abs(result - value) < 0.5;
        })
    )
  );
}

/**
 * Numbers in `after` that neither `before` nor the user's request has. A number the model
 * could have worked out from the text is flagged apart from one with no source at all.
 */
export function checkNewNumbers(
  before: string,
  after: string,
  requestText: string
): ProposalFlag[] {
  const known = new Set([...readNumbers(before), ...readNumbers(requestText)]);
  const added = [...readNumbers(after)].filter((number) => !known.has(number));
  const knownValues = [...readNumbers(before)].map(Number);
  const calculated = added.filter((number) => isCalculated(Number(number), knownValues));
  const unsourced = added.filter((number) => !calculated.includes(number));
  return [
    ...(unsourced.length ? [{ kind: 'newNumbers' as const, words: unsourced }] : []),
    ...(calculated.length ? [{ kind: 'calculatedNumbers' as const, words: calculated }] : []),
  ];
}
