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
lines.push('| Model | Rewrite only | Replace only | Both offered | Picked replace | API errors |');
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
  const pickedReplace = both.filter(
    (r) => r.tools.length && r.tools.every((t) => t === 'propose_replace')
  ).length;
  const label = file.replace(/^targeted-/, '').replace(/\.json$/, '');
  lines.push(
    `| ${label} | ${cell('rewrite')} | ${cell('replace')} | ${cell('both')} | ${pickedReplace}/${both.length} | ${rows.filter(isApiError).length} |`
  );
}

console.log(lines.join('\n'));
