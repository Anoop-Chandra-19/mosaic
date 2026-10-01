import type { Change } from './resumeChange';

/** The assistant writes these itself, so the short keys are what it is asked for. */
export type TextPhrase =
  | { k: 'keep'; t: string }
  | { k: 'edit'; id: string; del: string; ins: string };

/** Each edit kept (true, the default) or dropped (false), by its id. */
export type PhraseDecisions = Record<string, boolean>;

function requirePhrases(change: Change): TextPhrase[] {
  if (!change.phrases) throw new Error(`Change ${change.id} has no phrases`);
  return change.phrases;
}

export function joinPhrasesBefore(change: Change): string {
  return requirePhrases(change)
    .map((phrase) => (phrase.k === 'keep' ? phrase.t : phrase.del))
    .join('');
}

export function joinPhrasesAfter(change: Change, decisions: PhraseDecisions = {}): string {
  return requirePhrases(change)
    .map((phrase) =>
      phrase.k === 'keep' ? phrase.t : decisions[phrase.id] === false ? phrase.del : phrase.ins
    )
    .join('');
}

/** Only the assistant's phrases stand alone; a worked-out diff's don't. */
export function canTogglePhrases(change: Change): boolean {
  return change.origin === 'assistant' && !!change.phrases;
}

/**
 * The reconstruction check: the keeps and dels must be the source byte for byte, and for a
 * recorded change the keeps and inses must be what landed.
 */
export function checkPhrases(change: Change, beforeText: string, afterText?: string): boolean {
  if (!change.phrases) return true;
  if (joinPhrasesBefore(change) !== beforeText) return false;
  return afterText === undefined || joinPhrasesAfter(change) === afterText;
}

/** What landed: each dropped phrase becomes kept text, so a record holds only what was applied. */
export function keepLandedPhrases(change: Change, decisions: PhraseDecisions = {}): TextPhrase[] {
  const landed: TextPhrase[] = [];
  for (const phrase of requirePhrases(change)) {
    const kept =
      phrase.k === 'keep' ? phrase.t : decisions[phrase.id] === false ? phrase.del : null;
    if (kept === null) {
      landed.push(phrase);
      continue;
    }
    const last = landed.at(-1);
    if (last?.k === 'keep') last.t += kept;
    else landed.push({ k: 'keep', t: kept });
  }
  return landed;
}
