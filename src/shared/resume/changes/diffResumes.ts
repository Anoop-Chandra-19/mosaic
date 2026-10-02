import type { ResumeData } from '../../types/resume';
import { diffTextsAsPhrases } from './diffTextsAsPhrases';
import { findMoves, type Move } from './findMoves';
import { listChangeRows, type ChangeRow } from './listChangeRows';
import type { Change, ChangeLine } from './resumeChange';

export interface DiffLine {
  row: ChangeRow;
  beforeNumber: number | null;
  afterNumber: number | null;
  change: Change | null;
  isMove?: boolean;
}

export interface ResumeDiff {
  /**
   * Every printed line of `after` in page order, with lines only `before` printed set back in
   * where they stood, and a move line after anything that changed place.
   */
  lines: DiffLine[];
  /** What counts and is stepped through. */
  changes: Change[];
  /** Everything marked on the page, including changes inside things that came or went. */
  all: Change[];
}

/** Both sides' rows, in page order and by key. */
interface ResumeRows {
  before: ChangeRow[];
  after: ChangeRow[];
  beforeByKey: Map<string, ChangeRow>;
  afterByKey: Map<string, ChangeRow>;
}

function indexRows(before: ResumeData, after: ResumeData): ResumeRows {
  const beforeRows = listChangeRows(before);
  const afterRows = listChangeRows(after);
  return {
    before: beforeRows,
    after: afterRows,
    beforeByKey: new Map(beforeRows.map((row) => [row.key, row])),
    afterByKey: new Map(afterRows.map((row) => [row.key, row])),
  };
}

function findPrinted(rowsByKey: Map<string, ChangeRow>, key: string): ChangeRow | null {
  const row = rowsByKey.get(key);
  return row?.isPrinted ? row : null;
}

/** A text section's lines are its entries. */
const isEntryRow = (row: ChangeRow) =>
  row.line === 'entry' || row.line === 'summary' || row.line === 'text';

const SHORT_LINES: ReadonlySet<ChangeLine> = new Set(['field', 'item', 'section']);

function describeRowChange(
  row: ChangeRow,
  before: ChangeRow | null,
  after: ChangeRow | null
): Change {
  const base = {
    id: row.key,
    line: row.line,
    field: row.field,
    itemKind: row.itemKind,
    sectionId: row.sectionId,
    entryId: row.entryId,
    bulletId: row.bulletId,
    where: row.where,
    n: (after ?? before)?.n,
    label: row.label,
    origin: 'diff' as const,
  };
  if (before && after) {
    if (SHORT_LINES.has(row.line)) {
      const kind =
        row.line === 'section' ? 'rename' : row.line === 'field' ? 'subtitle' : 'rewrite';
      return { ...base, kind, from: before.text, to: after.text };
    }
    const phrases = diffTextsAsPhrases(before.text, after.text, `${row.key}:`);
    return { ...base, kind: 'rewrite', phrases, from: before.text, to: after.text };
  }
  if (after) return { ...base, kind: 'add', text: after.text };
  return { ...base, kind: 'remove', text: before?.text ?? '' };
}

/** On the page on one side only: left off, if it still has text on the other side, or gone. */
function describePresence(rows: ResumeRows, row: ChangeRow): Change | null {
  const printedBefore = findPrinted(rows.beforeByKey, row.key);
  const printedAfter = findPrinted(rows.afterByKey, row.key);
  if (!!printedBefore === !!printedAfter) return null;
  const change = describeRowChange(row, printedBefore, printedAfter);
  const otherSide = printedAfter ? rows.beforeByKey.get(row.key) : rows.afterByKey.get(row.key);
  if (!otherSide?.hasText) return change;
  const printed = printedBefore ?? printedAfter;
  return { ...change, kind: 'toggle', isOnPage: !!printedAfter, text: printed?.text };
}

/** Sections and entries that came, went, or were left off; changes inside them are children. */
function findParentChanges(rows: ResumeRows): Map<string, Change | null> {
  const parents = new Map<string, Change | null>();
  for (const row of [...rows.before, ...rows.after]) {
    if ((row.line === 'section' || row.line === 'entry') && !parents.has(row.key)) {
      parents.set(row.key, describePresence(rows, row));
    }
  }
  return parents;
}

function findParentChange(parents: Map<string, Change | null>, row: ChangeRow): Change | null {
  if (row.line === 'section') return null;
  const sectionChange = parents.get(`section:${row.sectionId}`);
  if (sectionChange) return sectionChange;
  if (row.line === 'entry') return null;
  return parents.get(`entry:${row.entryId}`) ?? null;
}

/** How a move names its neighbours: a bullet or line by number, anything else by name. */
function nameNeighbour(rowsByKey: Map<string, ChangeRow>, key: string): string {
  const row = rowsByKey.get(key);
  if (!row) return '';
  if (row.line === 'bullet') return `bullet ${row.n}`;
  if (row.line === 'summary' || row.line === 'text') return `line ${row.n}`;
  return row.label ?? row.text;
}

function describeMove(row: ChangeRow, fields: Partial<Change>): Change {
  return {
    id: `move:${row.key}`,
    kind: 'reorder',
    line: row.line,
    sectionId: row.sectionId,
    entryId: row.entryId,
    bulletId: row.bulletId,
    where: row.where,
    n: row.n,
    label: row.label,
    text: row.text,
    origin: 'diff',
    ...fields,
  };
}

function describeWhereItWas(rows: ResumeRows, move: Move, keyOf: (id: string) => string) {
  if (move.previousIdBefore) {
    return `was below ${nameNeighbour(rows.beforeByKey, keyOf(move.previousIdBefore))}`;
  }
  if (move.nextIdBefore) {
    return `was first, above ${nameNeighbour(rows.beforeByKey, keyOf(move.nextIdBefore))}`;
  }
  return 'was first';
}

/** The ids of the printed rows `isInList` picks, in page order. */
function listPrintedIds(
  rows: ChangeRow[],
  isInList: (row: ChangeRow) => boolean,
  idOf: (row: ChangeRow) => string | null
): string[] {
  return rows.flatMap((row) => {
    const id = row.isPrinted && isInList(row) ? idOf(row) : null;
    return id ? [id] : [];
  });
}

/**
 * Moves within each list both sides print: the sections, each section's entries, each
 * entry's bullets. An entry now in another section moved there.
 */
function findAllMoves(rows: ResumeRows): Map<string, Change> {
  const moves = new Map<string, Change>();
  const addMovesWithin = (
    isInList: (row: ChangeRow) => boolean,
    idOf: (row: ChangeRow) => string | null,
    keyOf: (id: string) => string
  ) => {
    const beforeIds = listPrintedIds(rows.before, isInList, idOf);
    const afterIds = listPrintedIds(rows.after, isInList, idOf);
    for (const move of findMoves(beforeIds, afterIds)) {
      const key = keyOf(move.id);
      const row = rows.afterByKey.get(key);
      const neighbourId = move.nextId ?? move.previousId;
      if (!row || !neighbourId) continue;
      const fields: Partial<Change> = {
        rel: move.nextId ? 'above' : 'below',
        other: nameNeighbour(rows.afterByKey, keyOf(neighbourId)),
        was: describeWhereItWas(rows, move, keyOf),
        isMovedUp: move.position < move.positionBefore,
      };
      moves.set(key, describeMove(row, fields));
    }
  };

  addMovesWithin(
    (row) => row.line === 'section',
    (row) => row.sectionId,
    (id) => `section:${id}`
  );
  for (const section of rows.after) {
    const isOnBothPages = section.isPrinted && findPrinted(rows.beforeByKey, section.key);
    if (section.line !== 'section' || !isOnBothPages) continue;
    addMovesWithin(
      (row) => isEntryRow(row) && row.sectionId === section.sectionId,
      (row) => row.entryId,
      (id) => `entry:${id}`
    );
  }
  for (const entry of rows.after) {
    const entryBefore = findPrinted(rows.beforeByKey, entry.key);
    if (!isEntryRow(entry) || !entry.isPrinted || !entryBefore) continue;
    addMovesWithin(
      (row) => row.line === 'bullet' && row.entryId === entry.entryId,
      (row) => row.bulletId,
      (id) => `bullet:${id}`
    );
    if (entryBefore.sectionId !== entry.sectionId && !moves.has(entry.key)) {
      const sectionBefore = rows.beforeByKey.get(`section:${entryBefore.sectionId}`);
      const fields: Partial<Change> = {
        rel: 'to',
        other: rows.afterByKey.get(`section:${entry.sectionId}`)?.text,
        was: `was in ${sectionBefore?.text ?? ''}`,
      };
      moves.set(entry.key, describeMove(entry, fields));
    }
  }
  return moves;
}

/**
 * Lines only `before` prints, by the key of the last line both sides print above them (''
 * when none is), so each goes back where it stood.
 */
function groupGoneRowsByAnchor(rows: ResumeRows): Map<string, ChangeRow[]> {
  const gone = new Map<string, ChangeRow[]>();
  let anchorKey = '';
  for (const row of rows.before) {
    if (!row.isPrinted || row.line === 'field') continue;
    if (findPrinted(rows.afterByKey, row.key)) anchorKey = row.key;
    else gone.set(anchorKey, [...(gone.get(anchorKey) ?? []), row]);
  }
  return gone;
}

export function diffResumes(before: ResumeData, after: ResumeData): ResumeDiff {
  const rows = indexRows(before, after);
  const parents = findParentChanges(rows);
  const moves = findAllMoves(rows);
  const goneByAnchor = groupGoneRowsByAnchor(rows);

  const markChild = (change: Change | null, row: ChangeRow): Change | null => {
    const parent = change && findParentChange(parents, row);
    return parent ? { ...change, isChild: true, parentKey: parent.id } : change;
  };
  const lines: DiffLine[] = [];
  const addGoneLines = (anchorKey: string) => {
    for (const row of goneByAnchor.get(anchorKey) ?? []) {
      const change = markChild(describePresence(rows, row), row);
      lines.push({ row, beforeNumber: row.n ?? null, afterNumber: null, change });
    }
  };

  addGoneLines('');
  for (const row of rows.after) {
    const rowBefore = rows.beforeByKey.get(row.key);
    if (row.line === 'field') {
      // Unchanged fields stay out: the entry's line already shows them.
      const printedBefore = findPrinted(rows.beforeByKey, row.key);
      const isChanged = printedBefore && printedBefore.text !== row.text;
      if (row.isPrinted && isChanged && !findParentChange(parents, row)) {
        const change = describeRowChange(row, printedBefore, row);
        lines.push({ row, beforeNumber: null, afterNumber: null, change });
      }
      continue;
    }
    if (!row.isPrinted) continue;
    const isReworded = rowBefore && rowBefore.text !== row.text && row.line !== 'entry';
    const change =
      describePresence(rows, row) ?? (isReworded ? describeRowChange(row, rowBefore, row) : null);
    lines.push({
      row,
      beforeNumber: rowBefore?.isPrinted ? (rowBefore.n ?? null) : null,
      afterNumber: row.n ?? null,
      change: markChild(change, row),
    });
    const move = moves.get(row.key);
    if (move)
      lines.push({ row, beforeNumber: null, afterNumber: null, change: move, isMove: true });
    addGoneLines(row.key);
  }

  const all = lines.flatMap((line) => (line.change ? [line.change] : []));
  return { lines, changes: all.filter((change) => !change.isChild), all };
}
