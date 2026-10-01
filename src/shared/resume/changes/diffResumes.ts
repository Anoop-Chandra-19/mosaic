import type { HeaderItemKind, ResumeData } from '../../types/resume';
import { formatEntryHeading } from '../entryHeading';
import type { Change, ChangeLine, EntryField } from './resumeChange';
import { diffTextsAsPhrases } from './diffTextsAsPhrases';

export interface ChangeRow {
  key: string;
  line: ChangeLine;
  text: string;
  isPrinted: boolean;
  /** Emptied, a thing is gone rather than left off the page. */
  hasText: boolean;
  field?: EntryField;
  itemKind?: HeaderItemKind;
  sectionId: string | null;
  entryId: string | null;
  bulletId: string | null;
  where: string;
  label?: string;
  n?: number | null;
}

const ENTRY_FIELDS: EntryField[] = ['title', 'organization', 'location', 'dates'];

const trim = (value: string | undefined) => (value ?? '').trim();

/** Rows are listed whether they print or not, so a diff can tell left off from deleted. */
export function listChangeRows(resume: ResumeData): ChangeRow[] {
  const header = { sectionId: null, entryId: null, bulletId: null, where: 'Header' };
  const name = trim(resume.contact.name);
  const rows: ChangeRow[] = [
    { key: 'name', line: 'name', text: name, isPrinted: true, hasText: true, ...header },
  ];
  for (const line of resume.contact.header.lines) {
    for (const item of line.items) {
      const text = trim(item.text);
      rows.push({
        key: `item:${item.id}`,
        line: 'item',
        itemKind: item.kind,
        text,
        isPrinted: item.shown && !!text,
        hasText: !!text,
        ...header,
      });
    }
  }

  for (const section of [...resume.sections].sort((a, b) => a.order - b.order)) {
    const isSectionOn = !section.hidden;
    const label = trim(section.label);
    const inSection = { sectionId: section.id, bulletId: null };
    rows.push({
      key: `section:${section.id}`,
      line: 'section',
      text: label,
      isPrinted: isSectionOn,
      hasText: true,
      ...inSection,
      entryId: null,
      where: label,
    });

    if (section.layout === 'lines') {
      // The app's summary is a text-only section, so each of its lines diffs word by word.
      const line = section.kind === 'summary' ? 'summary' : 'text';
      let n = 0;
      for (const entry of section.items) {
        const text = trim(entry.text);
        const isPrinted = isSectionOn && entry.selected && !!text;
        if (isPrinted) n++;
        rows.push({
          key: `entry:${entry.id}`,
          line,
          text,
          isPrinted,
          hasText: !!text,
          ...inSection,
          entryId: entry.id,
          where: line === 'summary' ? label : `${label} › line ${n}`,
          label: line === 'summary' ? 'Summary' : `${label}, line ${n}`,
          n: isPrinted ? n : null,
        });
      }
      continue;
    }

    for (const entry of section.items) {
      const isEntryOn = isSectionOn && entry.selected;
      const fields: Record<EntryField, string> = {
        title: trim(entry.title),
        organization: trim(entry.organization),
        location: trim(entry.location),
        dates: trim(entry.dates),
      };
      const heading = formatEntryHeading(fields);
      const entryName = fields.title || fields.organization;
      const where = entryName ? `${label} › ${entryName}` : label;
      const inEntry = { ...inSection, entryId: entry.id, where };
      const bullets = entry.bullets.map((bullet) => {
        const text = trim(bullet.text);
        return { id: bullet.id, text, isPrinted: isEntryOn && bullet.selected && !!text };
      });
      const hasText = !!(heading || fields.dates || bullets.some((bullet) => bullet.text));
      rows.push({
        key: `entry:${entry.id}`,
        line: 'entry',
        text: fields.dates ? `${heading}  ·  ${fields.dates}` : heading,
        label: entryName || heading || label,
        isPrinted:
          isEntryOn && !!(heading || fields.dates || bullets.some((bullet) => bullet.isPrinted)),
        hasText,
        ...inEntry,
      });
      for (const field of ENTRY_FIELDS) {
        rows.push({
          key: `${field}:${entry.id}`,
          line: 'field',
          field,
          text: fields[field],
          isPrinted: isEntryOn,
          hasText: true,
          ...inEntry,
        });
      }
      let n = 0;
      for (const bullet of bullets) {
        if (bullet.isPrinted) n++;
        rows.push({
          key: `bullet:${bullet.id}`,
          line: 'bullet',
          text: bullet.text,
          isPrinted: bullet.isPrinted,
          hasText: !!bullet.text,
          ...inEntry,
          bulletId: bullet.id,
          where: `${where} › bullet ${n}`,
          n: bullet.isPrinted ? n : null,
        });
      }
    }
  }
  return rows;
}

interface Move {
  id: string;
  next: string | null;
  prev: string | null;
  wasPrev: string | null;
  wasNext: string | null;
  position: number;
  wasPosition: number;
}

/**
 * What moved: the shared ids that are off the longest run both orders keep. On a tie, the
 * one that came forward is the one flagged.
 */
function findMoves(beforeIds: string[], afterIds: string[]): Move[] {
  const inBefore = new Set(beforeIds);
  const inAfter = new Set(afterIds);
  const before = beforeIds.filter((id) => inAfter.has(id));
  const after = afterIds.filter((id) => inBefore.has(id));
  const n = before.length;
  const m = after.length;
  const kept = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      kept[at(i, j)] =
        before[i] === after[j]
          ? kept[at(i + 1, j + 1)] + 1
          : Math.max(kept[at(i + 1, j)], kept[at(i, j + 1)]);
    }
  }
  const inPlace = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      inPlace.add(before[i]);
      i++;
      j++;
    } else if (kept[at(i + 1, j)] > kept[at(i, j + 1)]) i++;
    else j++;
  }
  return after.flatMap((id, k) => {
    if (inPlace.has(id)) return [];
    const was = before.indexOf(id);
    return {
      id,
      next: after[k + 1] ?? null,
      prev: after[k - 1] ?? null,
      wasPrev: before[was - 1] ?? null,
      wasNext: before[was + 1] ?? null,
      position: k + 1,
      wasPosition: was + 1,
    };
  });
}

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

export function diffResumes(before: ResumeData, after: ResumeData): ResumeDiff {
  const beforeRows = listChangeRows(before);
  const afterRows = listChangeRows(after);
  const beforeByKey = new Map(beforeRows.map((row) => [row.key, row]));
  const afterByKey = new Map(afterRows.map((row) => [row.key, row]));
  const printedIn = (rows: Map<string, ChangeRow>, key: string) => {
    const row = rows.get(key);
    return row?.isPrinted ? row : null;
  };

  // On the page on one side only: left off (it still has text on the other side) or gone.
  const describePresence = (row: ChangeRow): Change | null => {
    const was = printedIn(beforeByKey, row.key);
    const is = printedIn(afterByKey, row.key);
    if (!!was === !!is) return null;
    const change = describeRowChange(row, was, is);
    const other = is ? beforeByKey.get(row.key) : afterByKey.get(row.key);
    if (!other?.hasText) return change;
    return { ...change, kind: 'toggle', isOnPage: !!is, text: (was ?? is)?.text };
  };

  const parentChanges = new Map<string, Change | null>();
  for (const row of [...beforeRows, ...afterRows]) {
    if ((row.line === 'section' || row.line === 'entry') && !parentChanges.has(row.key)) {
      parentChanges.set(row.key, describePresence(row));
    }
  }
  const findParentChange = (row: ChangeRow) =>
    (row.line !== 'section' && parentChanges.get(`section:${row.sectionId}`)) ||
    (row.line !== 'section' && row.line !== 'entry' && parentChanges.get(`entry:${row.entryId}`)) ||
    null;
  const markChild = (change: Change, row: ChangeRow): Change => {
    const parent = findParentChange(row);
    return parent ? { ...change, isChild: true, parentKey: parent.id } : change;
  };

  const moves = new Map<string, Change>();
  const nameRow = (rows: Map<string, ChangeRow>, key: string) => {
    const row = rows.get(key);
    if (!row) return '';
    if (row.line === 'bullet') return `bullet ${row.n}`;
    if (row.line === 'summary' || row.line === 'text') return `line ${row.n}`;
    return row.label ?? row.text;
  };
  const describeWas = (move: Move, keyOf: (id: string) => string) => {
    if (move.wasPrev) return `was below ${nameRow(beforeByKey, keyOf(move.wasPrev))}`;
    if (move.wasNext) return `was first, above ${nameRow(beforeByKey, keyOf(move.wasNext))}`;
    return 'was first';
  };
  const describeMove = (row: ChangeRow, fields: Partial<Change>): Change => ({
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
  });
  const addMoves = (beforeIds: string[], afterIds: string[], keyOf: (id: string) => string) => {
    for (const move of findMoves(beforeIds, afterIds)) {
      const key = keyOf(move.id);
      const row = afterByKey.get(key);
      const neighbour = move.next ?? move.prev;
      if (!row || !neighbour) continue;
      moves.set(
        key,
        describeMove(row, {
          rel: move.next ? 'above' : 'below',
          other: nameRow(afterByKey, keyOf(neighbour)),
          was: describeWas(move, keyOf),
          isMovedUp: move.position < move.wasPosition,
        })
      );
    }
  };
  const printedIds = (
    rows: ChangeRow[],
    keep: (row: ChangeRow) => boolean,
    idOf: (row: ChangeRow) => string | null
  ) => rows.filter((row) => row.isPrinted && keep(row)).map((row) => idOf(row) ?? '');
  const isSection = (row: ChangeRow) => row.line === 'section';
  const isEntry = (row: ChangeRow) => row.key.startsWith('entry:');

  addMoves(
    printedIds(beforeRows, isSection, (row) => row.sectionId),
    printedIds(afterRows, isSection, (row) => row.sectionId),
    (id) => `section:${id}`
  );
  for (const section of afterRows) {
    if (!isSection(section) || !section.isPrinted || !printedIn(beforeByKey, section.key)) continue;
    const inSection = (row: ChangeRow) => isEntry(row) && row.sectionId === section.sectionId;
    addMoves(
      printedIds(beforeRows, inSection, (row) => row.entryId),
      printedIds(afterRows, inSection, (row) => row.entryId),
      (id) => `entry:${id}`
    );
  }
  for (const entry of afterRows) {
    if (!isEntry(entry) || !entry.isPrinted) continue;
    const was = printedIn(beforeByKey, entry.key);
    if (!was) continue;
    const inEntry = (row: ChangeRow) => row.line === 'bullet' && row.entryId === entry.entryId;
    addMoves(
      printedIds(beforeRows, inEntry, (row) => row.bulletId),
      printedIds(afterRows, inEntry, (row) => row.bulletId),
      (id) => `bullet:${id}`
    );
    if (was.sectionId !== entry.sectionId && !moves.has(entry.key)) {
      moves.set(
        entry.key,
        describeMove(entry, {
          rel: 'to',
          other: afterByKey.get(`section:${entry.sectionId}`)?.text,
          was: `was in ${beforeByKey.get(`section:${was.sectionId}`)?.text ?? ''}`,
        })
      );
    }
  }

  // Lines only `before` printed go back after the last line both sides print.
  const gone = new Map<string, ChangeRow[]>();
  let anchor = '';
  for (const row of beforeRows) {
    if (!row.isPrinted || row.line === 'field') continue;
    if (printedIn(afterByKey, row.key)) anchor = row.key;
    else gone.set(anchor, [...(gone.get(anchor) ?? []), row]);
  }

  const lines: DiffLine[] = [];
  const putGone = (anchorKey: string) => {
    for (const row of gone.get(anchorKey) ?? []) {
      const change = describePresence(row);
      lines.push({
        row,
        beforeNumber: row.n ?? null,
        afterNumber: null,
        change: change && markChild(change, row),
      });
    }
  };
  putGone('');
  for (const row of afterRows) {
    const was = beforeByKey.get(row.key);
    if (row.line === 'field') {
      // Unchanged fields stay out: the entry's line already shows them.
      const wasPrinted = printedIn(beforeByKey, row.key);
      if (row.isPrinted && wasPrinted && wasPrinted.text !== row.text && !findParentChange(row)) {
        const change = describeRowChange(row, wasPrinted, row);
        lines.push({ row, beforeNumber: null, afterNumber: null, change });
      }
      continue;
    }
    if (!row.isPrinted) continue;
    let change = describePresence(row);
    if (!change && was && was.text !== row.text && row.line !== 'entry') {
      change = describeRowChange(row, was, row);
    }
    lines.push({
      row,
      beforeNumber: was?.isPrinted ? (was.n ?? null) : null,
      afterNumber: row.n ?? null,
      change: change && markChild(change, row),
    });
    const move = moves.get(row.key);
    if (move)
      lines.push({ row, beforeNumber: null, afterNumber: null, change: move, isMove: true });
    putGone(row.key);
  }

  const all = lines.flatMap((line) => (line.change ? [line.change] : []));
  return { lines, changes: all.filter((change) => !change.isChild), all };
}
