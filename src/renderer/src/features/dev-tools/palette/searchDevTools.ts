import type { DevTool } from '../devTool';

/** Where a matched word sits in a label: `[start, end)`. */
export type MatchRange = [number, number];

export interface DevToolMatch {
  tool: DevTool;
  /** The typed words found in the label, to mark. */
  ranges: MatchRange[];
}

function splitWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** First a label that starts with the first word, then one holding every word, then the rest. */
function rankMatch(label: string, words: string[]): number {
  if (label.startsWith(words[0])) return 0;
  return words.every((word) => label.includes(word)) ? 1 : 2;
}

function findRanges(label: string, words: string[]): MatchRange[] {
  const ranges: MatchRange[] = [];
  for (const word of words) {
    const start = label.indexOf(word);
    if (start >= 0) ranges.push([start, start + word.length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * The tools whose name, group or description holds every typed word, best first. An empty
 * query matches nothing: the palette shows its groups instead.
 */
export function searchDevTools(tools: readonly DevTool[], query: string): DevToolMatch[] {
  const words = splitWords(query);
  if (words.length === 0) return [];
  return tools
    .filter((tool) => {
      const text = `${tool.label} ${tool.group} ${tool.description}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .map((tool) => ({ tool, label: tool.label.toLowerCase() }))
    .sort((a, b) => rankMatch(a.label, words) - rankMatch(b.label, words))
    .map(({ tool, label }) => ({ tool, ranges: findRanges(label, words) }));
}
