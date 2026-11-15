import { hasSameWords } from '@/lib/resume/hasSameWords';

/** Separators recognized in a list line. The first one found in the line is used. */
export const LIST_SEPARATORS = [', ', ' · ', ' | ', ' / ', '; '] as const;

export type ListItemFailure = 'notAList' | 'afterNotListed';

export type WrittenListItem = { line: string } | { failure: ListItemFailure };

/** Remove a leading label such as "Languages: " so the first item can be compared as "Go". */
const withoutLabel = (item: string) => item.replace(/^[^:]+:\s+/, '');

const isSameItem = (listed: string, named: string) =>
  hasSameWords(listed.toLowerCase(), named.toLowerCase()) ||
  hasSameWords(withoutLabel(listed).toLowerCase(), named.toLowerCase());

/**
 * Add one item to a list line, using the separator the line already uses. `after` is
 * the text of an existing item, "start" to add the item first, or undefined to add it
 * last. Return the line unchanged if it already contains the item. Fail if the line has
 * no separator or does not contain the `after` item.
 */
export function writeListItem(
  line: string,
  item: string,
  after: string | undefined
): WrittenListItem {
  const separator = LIST_SEPARATORS.find((each) => line.includes(each));
  if (!separator) return { failure: 'notAList' };
  const items = line.split(separator);
  if (items.some((listed) => isSameItem(listed, item))) return { line };

  const place = after?.trim();
  let index = items.length;
  if (place?.toLowerCase() === 'start') {
    // Move the label from the old first item to the new one, so the line still starts with it.
    const label = items[0].slice(0, items[0].length - withoutLabel(items[0]).length);
    items[0] = withoutLabel(items[0]);
    items.unshift(`${label}${item}`);
    return { line: items.join(separator) };
  }
  if (place) {
    const afterIndex = items.findIndex((listed) => isSameItem(listed, place));
    if (afterIndex === -1) return { failure: 'afterNotListed' };
    index = afterIndex + 1;
  }
  items.splice(index, 0, item);
  return { line: items.join(separator) };
}
