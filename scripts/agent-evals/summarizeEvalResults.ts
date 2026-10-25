/**
 * Markdown tables from every run in `results/`, one row per model and shape.
 *
 *   node scripts/agent-evals/summarizeEvalResults.ts > summary.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { medianOf, RESULTS_DIR } from './evalCommandLine.ts';

interface BulletRow {
  shape: string;
  bulletId: string;
  outcome: string;
  ms: number;
  tokensOut: number;
  editCount?: number;
  newNumbers?: string[];
  claimsMore?: boolean;
}

interface TargetedRow {
  caseNumber: number;
  kind: string;
  mode: string;
  isExact: boolean;
  tools: string[];
  notes: string[];
}

const readRows = <T>(file: string) =>
  JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8')) as T[];

const files = fs.existsSync(RESULTS_DIR) ? fs.readdirSync(RESULTS_DIR).sort() : [];
const lines: string[] = [];

// A later run of one shape (`-text`, `-edits+text`) replaces that shape from an earlier run.
const bulletRuns = new Map<string, Map<string, BulletRow>>();
for (const file of files.filter((f) => f.startsWith('bullets-'))) {
  const label = file
    .replace(/^bullets-/, '')
    .replace(/\.json$/, '')
    .replace(/-(segments|text|edits)(\+(segments|text|edits))*$/, '');
  const byKey = bulletRuns.get(label) ?? new Map<string, BulletRow>();
  for (const row of readRows<BulletRow>(file)) byKey.set(`${row.shape}:${row.bulletId}`, row);
  bulletRuns.set(label, byKey);
}

lines.push(
  '| Model | Shape | First try | After repair | Failed | 2+ edits | Claims more | New numbers | Median s | Out tokens |'
);
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [label, byKey] of [...bulletRuns].sort(([a], [b]) => a.localeCompare(b))) {
  for (const shape of ['text', 'edits', 'segments']) {
    const rows = [...byKey.values()].filter((r) => r.shape === shape);
    if (rows.length === 0) continue;
    const firstTry = rows.filter((r) => r.outcome === 'ok');
    const repaired = rows.filter((r) => r.outcome === 'ok-after-repair');
    const accepted = [...firstTry, ...repaired];
    const apiErrors = rows.filter((r) => r.outcome === 'error').length;
    const failed = rows.length - accepted.length - apiErrors;
    const newNumbers = accepted.filter((r) => r.newNumbers?.length).map((r) => r.bulletId);
    const cells = [
      label,
      shape,
      `${firstTry.length}/${rows.length}`,
      repaired.length,
      `${failed}${apiErrors ? ` (+${apiErrors} API errors)` : ''}`,
      shape === 'text' ? '–' : accepted.filter((r) => (r.editCount ?? 0) >= 2).length,
      accepted.filter((r) => r.claimsMore).length,
      newNumbers.join(' ') || 0,
      (medianOf(rows.map((r) => r.ms)) / 1000).toFixed(1),
      rows.reduce((sum, r) => sum + r.tokensOut, 0),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
}

lines.push('');
lines.push(
  '| Model | Rewrite only | Rewrite + replace everywhere | Replace on one bullet | Replace when everywhere | API errors |'
);
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const file of files.filter((f) => f.startsWith('targeted-'))) {
  const rows = readRows<TargetedRow>(file);
  const isApiError = (row: TargetedRow) => row.notes.some((note) => note.startsWith('error'));
  const cell = (mode: string) => {
    const modeRows = rows.filter((r) => r.mode === mode);
    const misses = modeRows
      .filter((r) => !r.isExact && !isApiError(r))
      .map((r) => `#${r.caseNumber}`);
    return `${modeRows.filter((r) => r.isExact).length}/${modeRows.length}${misses.length ? ` (${misses.join(' ')})` : ''}`;
  };
  const both = rows.filter((r) => r.mode === 'both');
  const usedReplace = (r: TargetedRow) => r.tools.includes('propose_replace_everywhere');
  const oneBullet = both.filter((r) => r.kind !== 'everywhere');
  const everywhere = both.filter((r) => r.kind === 'everywhere');
  const label = file.replace(/^targeted-/, '').replace(/\.json$/, '');
  lines.push(
    `| ${label} | ${cell('rewrite')} | ${cell('both')} | ${oneBullet.filter(usedReplace).length}/${oneBullet.length} | ${everywhere.filter(usedReplace).length}/${everywhere.length} | ${rows.filter(isApiError).length} |`
  );
}

interface AddRow {
  set: string;
  caseNumber: number;
  shape: string;
  answers: string;
  isRight: boolean;
  refusals: number;
  repeats: number;
}

// Held-out cases are never tuned against, so they stay a row of their own.
const addFiles = files.filter((f) => f.startsWith('add-'));
if (addFiles.length) {
  lines.push('');
  lines.push('| Model | Tools | Cases | Right | Wrong | Refused | Repeats |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
}
for (const file of addFiles) {
  const rows = readRows<AddRow>(file);
  const label = file.replace(/^add-/, '').replace(/\.json$/, '');
  const variants = [...new Set(rows.map((r) => `${r.shape}/${r.answers}`))];
  for (const variant of variants) {
    for (const set of [...new Set(rows.map((r) => r.set))]) {
      const setRows = rows.filter((r) => `${r.shape}/${r.answers}` === variant && r.set === set);
      const wrong = setRows.filter((r) => !r.isRight).map((r) => `#${r.caseNumber}`);
      const refusals = setRows.reduce((sum, r) => sum + r.refusals, 0);
      const repeats = setRows.reduce((sum, r) => sum + r.repeats, 0);
      lines.push(
        `| ${label} | ${variant} | ${set} | ${setRows.length - wrong.length}/${setRows.length} | ${wrong.join(' ') || '–'} | ${refusals} | ${repeats} |`
      );
    }
  }
}

console.log(lines.join('\n'));
