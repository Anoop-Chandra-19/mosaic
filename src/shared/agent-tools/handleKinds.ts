/**
 * The kinds of thing a handle names, and the letter its handles start with: "s1" is a
 * section, "e2" an entry, "b7" a bullet, "l3" a line. The tool definitions describe their
 * handle arguments with these, and the renderer gives handles out by them.
 */

export type HandleKind = 'section' | 'entry' | 'bullet' | 'line';

export const HANDLE_PREFIXES: Record<HandleKind, string> = {
  section: 's',
  entry: 'e',
  bullet: 'b',
  line: 'l',
};

export const HANDLE_KINDS = Object.keys(HANDLE_PREFIXES) as HandleKind[];

export const exampleHandle = (kind: HandleKind) => `${HANDLE_PREFIXES[kind]}1`;

/** "a or b", "a, b or c". */
export const listEither = (words: readonly string[]) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;

/** "a bullet or line handle from the resume, such as b1 or l1". */
export function describeHandleKinds(kinds: readonly HandleKind[]): string {
  const article = kinds[0] === 'entry' ? 'an' : 'a';
  const examples = listEither(kinds.map(exampleHandle));
  return `${article} ${listEither(kinds)} handle from the resume, such as ${examples}`;
}
