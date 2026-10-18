/**
 * A hand-run check's results as a table, each number followed by its change since the
 * check's last run. The run is kept in `file` (under `out/`) for the next one to compare.
 */
import fs from 'node:fs';
import path from 'node:path';

/** One row: what was measured (`name`), and a number, or null, per column. */
export type ResultRow = { name: string } & Record<string, string | number | null>;

export interface ResultColumn {
  key: string;
  label: string;
}

const CELL_WIDTH = 13;

function formatCell(value: string | number | null | undefined, was: unknown): string {
  if (typeof value !== 'number') return '–'.padStart(CELL_WIDTH);
  const change = typeof was === 'number' ? Math.round((value - was) * 10) / 10 : null;
  const shown = change === null ? '' : ` (${change >= 0 ? '+' : ''}${change})`;
  return `${value}${shown}`.padStart(CELL_WIDTH);
}

function readLastRun(file: string): ResultRow[] | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ResultRow[];
  } catch {
    return null;
  }
}

/** Prints `rows` against the last run kept in `file`, then keeps these in its place. */
export function reportAgainstLastRun(
  rows: ResultRow[],
  columns: ResultColumn[],
  file: string,
  firstColumnLabel: string
): void {
  const previous = readLastRun(file);
  const nameWidth = Math.max(firstColumnLabel.length, ...rows.map((row) => row.name.length));
  console.log(
    [
      firstColumnLabel.padEnd(nameWidth),
      ...columns.map(({ label }) => label.padStart(CELL_WIDTH)),
    ].join(' ')
  );
  for (const row of rows) {
    const was = previous?.find((old) => old.name === row.name);
    console.log(
      [
        row.name.padEnd(nameWidth),
        ...columns.map(({ key }) => formatCell(row[key], was?.[key])),
      ].join(' ')
    );
  }
  if (previous) console.log('In brackets: the change since the last run.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}
