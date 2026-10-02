import type { ResumeData } from '../../types/resume';
import { diffTextsAsPhrases } from './diffTextsAsPhrases';
import { findMoves, type Move } from './findMoves';
import { listChangeRows, type ChangeRow } from './listChangeRows';
import type { Change, ChangeTargetType, Placement } from './resumeChange';

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
const isEntryRow = ({ target }: ChangeRow) =>
  target.type === 'entry' || target.type === 'summaryLine' || target.type === 'textLine';

const SHORT_TARGETS: ReadonlySet<ChangeTargetType> = new Set([
  'entryField',
  'headerItem',
  'section',
]);

/** What happened to a row: edited, if both sides print it, or added or removed. */
function describeRowChange(
  row: ChangeRow,
  before: ChangeRow | null,
  after: ChangeRow | null
): Change {
  const change: Change = {
    id: row.key,
    kind: before ? (after ? 'edit' : 'remove') : 'add',
    target: row.target,
    path: row.path,
    number: (after ?? before)?.number ?? null,
    displayName: row.displayName,
    before: before?.text ?? '',
    after: after?.text ?? '',
    origin: 'diff',
  };
  if (change.kind === 'edit' && !SHORT_TARGETS.has(row.target.type)) {
    change.phrases = diffTextsAsPhrases(change.before, change.after, `${row.key}:`);
  }
  return change;
}

/** On the page on one side only: left off, if it still has text on the other side, or gone. */
function describePresence(rows: ResumeRows, row: ChangeRow): Change | null {
  const printedBefore = findPrinted(rows.beforeByKey, row.key);
  const printedAfter = findPrinted(rows.afterByKey, row.key);
  if (!!printedBefore === !!printedAfter) return null;
  const change = describeRowChange(row, printedBefore, printedAfter);
  const otherSide = printedAfter ? rows.beforeByKey.get(row.key) : rows.afterByKey.get(row.key);
  if (!otherSide?.hasText) return change;
  return { ...change, kind: printedAfter ? 'show' : 'hide' };
}

/** Sections and entries that came, went, or were left off; changes inside them are children. */
function findParentChanges(rows: ResumeRows): Map<string, Change | null> {
  const parents = new Map<string, Change | null>();
  for (const row of [...rows.before, ...rows.after]) {
    const isParent = row.target.type === 'section' || row.target.type === 'entry';
    if (isParent && !parents.has(row.key)) parents.set(row.key, describePresence(rows, row));
  }
  return parents;
}

function findParentChange(parents: Map<string, Change | null>, row: ChangeRow): Change | null {
  const { type, sectionId, entryId } = row.target;
  if (type === 'section') return null;
  const sectionChange = parents.get(`section:${sectionId}`);
  if (sectionChange) return sectionChange;
  if (type === 'entry') return null;
  return parents.get(`entry:${entryId}`) ?? null;
}

/** How a move names its neighbours: a bullet or line by number, anything else by name. */
function nameNeighbour(rowsByKey: Map<string, ChangeRow>, key: string): string {
  const row = rowsByKey.get(key);
  if (!row) return '';
  if (row.target.type === 'bullet') return `bullet ${row.number}`;
  if (row.target.type === 'summaryLine' || row.target.type === 'textLine') {
    return `line ${row.number}`;
  }
  return row.displayName ?? row.text;
}

function describeMove(row: ChangeRow, rowBefore: ChangeRow, move: Change['move']): Change {
  return {
    id: `move:${row.key}`,
    kind: 'move',
    target: row.target,
    path: row.path,
    number: row.number,
    displayName: row.displayName,
    before: rowBefore.text,
    after: row.text,
    move,
    origin: 'diff',
  };
}

const ALONE: Placement = { relation: 'alone', name: '' };

/** Where it is now: above the one it now leads, or else below the one it follows. */
function placeAfterMove(rows: ResumeRows, move: Move, keyOf: (id: string) => string): Placement {
  const name = (id: string) => nameNeighbour(rows.afterByKey, keyOf(id));
  if (move.nextId) return { relation: 'above', name: name(move.nextId) };
  if (move.previousId) return { relation: 'below', name: name(move.previousId) };
  return ALONE;
}

/** Where it was: below the one it followed, or else first, above the one it led. */
function placeBeforeMove(rows: ResumeRows, move: Move, keyOf: (id: string) => string): Placement {
  const name = (id: string) => nameNeighbour(rows.beforeByKey, keyOf(id));
  if (move.previousIdBefore) return { relation: 'below', name: name(move.previousIdBefore) };
  if (move.nextIdBefore) return { relation: 'above', name: name(move.nextIdBefore) };
  return ALONE;
}

/** The ids of the printed rows `isInList` picks, in page order. */
function listPrintedIds(
  rows: ChangeRow[],
  isInList: (row: ChangeRow) => boolean,
  idOf: (row: ChangeRow) => string | undefined
): string[] {
  return rows.flatMap((row) => {
    const id = row.isPrinted && isInList(row) ? idOf(row) : undefined;
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
    idOf: (row: ChangeRow) => string | undefined,
    keyOf: (id: string) => string
  ) => {
    const beforeIds = listPrintedIds(rows.before, isInList, idOf);
    const afterIds = listPrintedIds(rows.after, isInList, idOf);
    for (const move of findMoves(beforeIds, afterIds)) {
      const key = keyOf(move.id);
      const row = rows.afterByKey.get(key);
      const rowBefore = rows.beforeByKey.get(key);
      const placement = placeAfterMove(rows, move, keyOf);
      if (!row || !rowBefore || placement.relation === 'alone') continue;
      moves.set(
        key,
        describeMove(row, rowBefore, {
          placement,
          placementBefore: placeBeforeMove(rows, move, keyOf),
          isMovedUp: move.position < move.positionBefore,
        })
      );
    }
  };

  addMovesWithin(
    ({ target }) => target.type === 'section',
    ({ target }) => target.sectionId,
    (id) => `section:${id}`
  );
  for (const section of rows.after) {
    const isOnBothPages = section.isPrinted && findPrinted(rows.beforeByKey, section.key);
    if (section.target.type !== 'section' || !isOnBothPages) continue;
    addMovesWithin(
      (row) => isEntryRow(row) && row.target.sectionId === section.target.sectionId,
      ({ target }) => target.entryId,
      (id) => `entry:${id}`
    );
  }
  for (const entry of rows.after) {
    const entryBefore = findPrinted(rows.beforeByKey, entry.key);
    if (!isEntryRow(entry) || !entry.isPrinted || !entryBefore) continue;
    addMovesWithin(
      ({ target }) => target.type === 'bullet' && target.entryId === entry.target.entryId,
      ({ target }) => target.bulletId,
      (id) => `bullet:${id}`
    );
    const sectionId = entry.target.sectionId;
    const sectionIdBefore = entryBefore.target.sectionId;
    if (sectionIdBefore !== sectionId && !moves.has(entry.key)) {
      const sectionName = (byKey: Map<string, ChangeRow>, id: string | undefined) =>
        byKey.get(`section:${id}`)?.text ?? '';
      moves.set(
        entry.key,
        describeMove(entry, entryBefore, {
          placement: { relation: 'in', name: sectionName(rows.afterByKey, sectionId) },
          placementBefore: { relation: 'in', name: sectionName(rows.beforeByKey, sectionIdBefore) },
          isMovedUp: false,
        })
      );
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
    if (!row.isPrinted || row.target.type === 'entryField') continue;
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
    return parent ? { ...change, parentId: parent.id } : change;
  };
  const lines: DiffLine[] = [];
  const addGoneLines = (anchorKey: string) => {
    for (const row of goneByAnchor.get(anchorKey) ?? []) {
      const change = markChild(describePresence(rows, row), row);
      lines.push({ row, beforeNumber: row.number, afterNumber: null, change });
    }
  };

  addGoneLines('');
  for (const row of rows.after) {
    const rowBefore = rows.beforeByKey.get(row.key);
    if (row.target.type === 'entryField') {
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
    const isReworded = rowBefore && rowBefore.text !== row.text && row.target.type !== 'entry';
    const change =
      describePresence(rows, row) ?? (isReworded ? describeRowChange(row, rowBefore, row) : null);
    lines.push({
      row,
      beforeNumber: rowBefore?.isPrinted ? rowBefore.number : null,
      afterNumber: row.number,
      change: markChild(change, row),
    });
    const move = moves.get(row.key);
    if (move)
      lines.push({ row, beforeNumber: null, afterNumber: null, change: move, isMove: true });
    addGoneLines(row.key);
  }

  const all = lines.flatMap((line) => (line.change ? [line.change] : []));
  return { lines, changes: all.filter((change) => !change.parentId), all };
}
