import type { ChangeRow, DiffLine } from '@shared/resume/changes/diffResumes';
import { trimPathToGroup } from '@shared/resume/changes/resumeChange';

export type HunkItem =
  | { kind: 'line'; line: DiffLine }
  | { kind: 'fold'; id: string; lines: DiffLine[]; noun: 'bullet' | 'line' };

/** One entry's lines, or a section's, or the header's: a hunk of the unified view. */
export interface Hunk {
  key: string;
  title: string;
  items: HunkItem[];
}

function hunkKeyOf({ target }: ChangeRow): string {
  switch (target.type) {
    case 'name':
    case 'headerItem':
      return 'header';
    case 'section':
    case 'summaryLine':
    case 'textLine':
      return `section:${target.sectionId}`;
    default:
      return `entry:${target.entryId}`;
  }
}

const isFoldable = ({ target }: ChangeRow) =>
  target.type === 'bullet' || target.type === 'summaryLine' || target.type === 'textLine';

/** Unchanged bullets or lines, one either side of a change kept as context. */
function foldUnchanged(key: string, lines: DiffLine[], openFoldIds: ReadonlySet<string>) {
  const isNearChange = (index: number) =>
    [index - 1, index, index + 1].some((near) => lines[near]?.change);
  const items: HunkItem[] = [];
  let folded: DiffLine[] = [];
  const closeFold = () => {
    if (folded.length === 0) return;
    const id = `${key}:${items.length}`;
    const noun = folded[0].row.target.type === 'bullet' ? 'bullet' : 'line';
    if (openFoldIds.has(id)) items.push(...folded.map((line) => ({ kind: 'line' as const, line })));
    else items.push({ kind: 'fold', id, lines: folded, noun });
    folded = [];
  };
  lines.forEach((line, index) => {
    if (isFoldable(line.row) && !isNearChange(index)) {
      folded.push(line);
      return;
    }
    closeFold();
    items.push({ kind: 'line', line });
  });
  closeFold();
  return items;
}

/** The diff's lines as hunks, keeping only the hunks with a change in them. */
export function groupDiffLinesIntoHunks(
  lines: DiffLine[],
  openFoldIds: ReadonlySet<string> = new Set()
): Hunk[] {
  const byKey = new Map<string, DiffLine[]>();
  for (const line of lines) {
    const key = hunkKeyOf(line.row);
    byKey.set(key, [...(byKey.get(key) ?? []), line]);
  }
  return [...byKey]
    .filter(([, hunkLines]) => hunkLines.some((line) => line.change))
    .map(([key, hunkLines]) => ({
      key,
      title: trimPathToGroup(hunkLines[0].row.path),
      items: foldUnchanged(key, hunkLines, openFoldIds),
    }));
}
