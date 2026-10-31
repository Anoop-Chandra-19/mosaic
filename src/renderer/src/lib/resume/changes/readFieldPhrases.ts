import { diffTextsAsPhrases } from './diffTextsAsPhrases';
import type { Change, TextPhrase } from './resumeChange';

/**
 * How a short field's edit is drawn: a section's name word by word, as the sentence it reads as;
 * any other field whole, old then new, since half a date or an address reads as nothing.
 */
export function readFieldPhrases({ target, before, after }: Change): TextPhrase[] {
  if (target.type === 'section') return diffTextsAsPhrases(before, after);
  return [{ k: 'edit', del: before, ins: after }];
}
