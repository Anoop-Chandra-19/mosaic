/**
 * Where each page of every swept resume ends, in the preview, the PDF, and the Word file as
 * LibreOffice lays it out, and how often they agree. Needs `soffice` and `pdftotext`.
 *
 *   node scripts/page-break-sweep/comparePageBreaks.ts [seed]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatEntryHeading } from '../../src/shared/resume/entryHeading.ts';
import type { ResumeData } from '../../src/shared/types/resume.ts';
import type { SweepResume } from './generateSweepResumes.ts';
import { runDirectory, SWEEP_SEED } from './sweepOptions.ts';

type Format = 'preview' | 'pdf' | 'docx';
type ElementKind = 'header' | 'title' | 'line' | 'bullet' | 'paragraph';

interface ResumeElement {
  kind: ElementKind;
  start: number;
  end: number;
}

interface Mismatch {
  resume: string;
  pair: string;
  kind: 'paragraph wrap' | 'rule' | 'page count';
  breaks: [number[], number[]];
  at?: string;
}

/** Words as all three print them, without list markers and header separators. */
const toWords = (text: string) =>
  text.split(/\s+/).filter((word) => word && !/^[•|·—]+$/.test(word));

/** Every printed element, in order, as a range of word offsets. */
function listElements(doc: ResumeData): ResumeElement[] {
  const elements: ResumeElement[] = [];
  let offset = 0;
  const add = (kind: ElementKind, text: string) => {
    const count = toWords(text).length;
    if (count > 0) elements.push({ kind, start: offset, end: offset + count });
    offset += count;
  };
  const shownItems = doc.contact.header.lines.flatMap((line) =>
    line.items.filter((item) => item.shown).map((item) => item.text)
  );
  add('header', [doc.contact.name, ...shownItems].join(' '));
  for (const section of [...doc.sections].sort((a, b) => a.order - b.order)) {
    if (section.hidden) continue;
    add('title', section.label);
    for (const entry of section.items.filter((item) => item.selected)) {
      if (section.layout === 'lines') {
        add('paragraph', entry.text ?? '');
        continue;
      }
      add('line', `${formatEntryHeading(entry)} ${entry.dates ?? ''}`);
      for (const bullet of entry.bullets.filter((item) => item.selected))
        add('bullet', bullet.text);
    }
  }
  return elements;
}

/** How many words come before each page after the first. */
const breakOffsets = (pages: string[][]) =>
  pages
    .slice(0, -1)
    .map((_, index) => pages.slice(0, index + 1).reduce((sum, page) => sum + page.length, 0));

function readPdfPages(file: string): string[][] {
  const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
  return text
    .split('\f')
    .filter((page) => page.trim())
    .map(toWords);
}

function layOutWordFiles(dir: string) {
  const laidOut = path.join(dir, 'libreoffice');
  fs.mkdirSync(laidOut, { recursive: true });
  const waiting = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.docx'))
    .filter((name) => !fs.existsSync(path.join(laidOut, name.replace(/\.docx$/, '.pdf'))));
  if (waiting.length === 0) return;
  // Its own profile, so an open LibreOffice window neither blocks it nor is touched.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'page-break-sweep-lo-'));
  try {
    execFileSync(
      'soffice',
      [
        `-env:UserInstallation=file://${profile}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        laidOut,
        ...waiting.map((name) => path.join(dir, name)),
      ],
      { stdio: 'ignore', timeout: 30 * 60_000 }
    );
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

function describeMismatch(
  elements: ResumeElement[],
  left: number[],
  right: number[]
): Pick<Mismatch, 'kind' | 'at'> {
  if (left.length !== right.length) return { kind: 'page count' };
  const index = left.findIndex((offset, i) => offset !== right[i]);
  const [a, b] = [Math.min(left[index], right[index]), Math.max(left[index], right[index])];
  const within = elements.find((element) => element.start <= a && b <= element.end);
  const isInside = within && (within.start < a || b < within.end);
  return {
    kind: within?.kind === 'paragraph' && isInside ? 'paragraph wrap' : 'rule',
    at: `break ${index + 1}, words ${a} and ${b}`,
  };
}

const seed = Number(process.argv[2] ?? SWEEP_SEED);
const dir = runDirectory(seed);
layOutWordFiles(dir);

const PAIRS: [Format, Format][] = [
  ['preview', 'pdf'],
  ['preview', 'docx'],
  ['pdf', 'docx'],
];
const tally = new Map(
  PAIRS.map(([a, b]) => [`${a}–${b}`, { resumes: 0, breaks: 0, same: 0, sameBreaks: 0 }])
);
const mismatches: Mismatch[] = [];
const unreadable: string[] = [];
let total = 0;

for (const file of fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .sort()) {
  if (file === 'summary.json') continue;
  const run = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as SweepResume & {
    previewPages: string[];
  };
  const elements = listElements(run.doc);
  const wordCount = elements.at(-1)!.end;
  const pages: Record<Format, string[][]> = {
    preview: run.previewPages.map(toWords),
    pdf: readPdfPages(path.join(dir, `${run.id}.pdf`)),
    docx: readPdfPages(path.join(dir, 'libreoffice', `${run.id}.pdf`)),
  };
  // Offsets only line up when every format read back every word.
  const counts = Object.values(pages).map((list) => list.flat().length);
  if (counts.some((count) => count !== wordCount)) {
    unreadable.push(`${run.id}: expected ${wordCount} words, read ${counts.join(' / ')}`);
    continue;
  }
  total += 1;
  const breaks = {
    preview: breakOffsets(pages.preview),
    pdf: breakOffsets(pages.pdf),
    docx: breakOffsets(pages.docx),
  };
  for (const [a, b] of PAIRS) {
    const entry = tally.get(`${a}–${b}`)!;
    const [left, right] = [breaks[a], breaks[b]];
    entry.resumes += 1;
    entry.breaks += Math.max(left.length, right.length);
    entry.sameBreaks += left.filter((offset, i) => offset === right[i]).length;
    if (JSON.stringify(left) === JSON.stringify(right)) {
      entry.same += 1;
      continue;
    }
    mismatches.push({
      resume: run.id,
      pair: `${a}–${b}`,
      breaks: [left, right],
      ...describeMismatch(elements, left, right),
    });
  }
}

const percent = (part: number, whole: number) =>
  whole ? `${((100 * part) / whole).toFixed(2)}%` : '–';
console.log(
  `Seed ${seed}: ${total} resumes compared${unreadable.length ? `, ${unreadable.length} not read in full` : ''}\n`
);
console.log('| Pair | Resumes alike | Page breaks alike | Paragraph wraps | Rules | Page counts |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const [pair, entry] of tally) {
  const kinds = (kind: Mismatch['kind']) =>
    mismatches.filter((m) => m.pair === pair && m.kind === kind).length;
  console.log(
    `| ${pair} | ${entry.same}/${entry.resumes} (${percent(entry.same, entry.resumes)}) | ${entry.sameBreaks}/${entry.breaks} (${percent(entry.sameBreaks, entry.breaks)}) | ${kinds('paragraph wrap')} | ${kinds('rule')} | ${kinds('page count')} |`
  );
}
for (const line of unreadable) console.log(`not read in full: ${line}`);
for (const m of mismatches.filter((item) => item.kind !== 'paragraph wrap')) {
  console.log(`${m.kind}: ${m.resume} ${m.pair} ${m.at ?? ''} ${JSON.stringify(m.breaks)}`);
}
fs.writeFileSync(
  path.join(dir, 'summary.json'),
  JSON.stringify({ tally: [...tally], mismatches, unreadable }, null, 2)
);
