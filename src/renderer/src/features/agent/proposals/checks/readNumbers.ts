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
  fifty: '50',
  hundred: '100',
};
const NUMBER_WORD = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'g');

/**
 * A number standing on its own, or as a multiplier (4.5x); never part of a name with
 * digits in it, and never cut short ("4.5km" is not a 4).
 */
const NUMBER = /(?<![a-z\d.])\d[\d,]*(?:\.\d+)?(?![a-wyz\d]|x[a-z]|\.\d)/g;

/**
 * The numbers a text states, as digits: "three" and "3" are the same number, and "1,200"
 * is 1200. Names with digits in them (e2e, S3, K8s) are not numbers.
 */
export function readNumbers(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(NUMBER_WORD, (word) => NUMBER_WORDS[word]);
  const numbers = normalized.match(NUMBER) ?? [];
  return new Set(numbers.map((number) => number.replace(/,(?=\d{3}\b)/g, '').replace(/,$/, '')));
}
