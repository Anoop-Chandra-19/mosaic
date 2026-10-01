import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { saveInto } from './dialogs';
import { test, withApp } from './launch';

const mosaic = withApp();
const MARGIN_BOTTOM_PT = 67.95;

const words = (text: string) => text.replace(/•/g, ' ').split(/\s+/).filter(Boolean);
const long = (seed: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${seed}${i}`).join(' ');
const shortBullets = (count: number) =>
  Array.from({ length: count }, (_, i) => `- Short bullet ${i}.`);

/** Each ran onto a second page at a different place in the preview than in the PDF. */
const RESUMES: Record<string, string[]> = {
  'a page of one-line bullets': [...shortBullets(36)],
  'an entry whose first bullet does not fit': [
    ...shortBullets(31),
    'Analyst, Northwind Freight',
    `- Opener ${long('op', 60)}.`,
  ],
  'a section whose title lands at the foot': [
    ...shortBullets(31),
    '',
    'Projects',
    'Fare dashboard',
    `- Built ${long('pr', 30)}.`,
  ],
  'an opening bullet that fits a page but not under the header': [`- Opener ${long('op', 480)}.`],
  'an opening bullet no page can hold': [`- Giant ${long('gi', 600)}.`],
  'a bullet no page can hold, after others': [...shortBullets(12), `- Giant ${long('gi', 600)}.`],
  'a paragraph whose title lands at the foot': [
    ...shortBullets(31),
    '',
    'Summary',
    `Summary ${long('su', 60)}.`,
  ],
};

/** Each page's words, and the lowest baseline on it, in points up from the page's foot. */
async function readPdfPages(file: string) {
  const pdf = await getDocument({
    data: new Uint8Array(fs.readFileSync(file)),
    standardFontDataUrl: `${path.resolve('node_modules/pdfjs-dist/standard_fonts')}/`,
  }).promise;
  const pages: { words: string[]; lowest: number }[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const items = (await (await pdf.getPage(number)).getTextContent()).items.filter(
      (item) => 'str' in item && item.str.trim()
    );
    pages.push({
      words: words(items.map((item) => ('str' in item ? item.str : '')).join(' ')),
      lowest: Math.min(...items.map((item) => ('transform' in item ? item.transform[5] : 0))),
    });
  }
  return pages;
}

for (const [name, lines] of Object.entries(RESUMES)) {
  test(`the preview breaks pages where the PDF does: ${name}`, async () => {
    const { app, page, userDataDir, errors } = mosaic();
    await saveInto(app, userDataDir);
    await page.getByRole('button', { name: /Blank resume/ }).click();

    await page.getByRole('button', { name: 'Import resume' }).click();
    const importing = page.getByRole('dialog', { name: 'Import' });
    const text = ['Sam Rivera', 'sam@example.com', '', 'Experience', 'Engineer, Harbor Transit Co'];
    await importing.getByLabel('Or paste the text').fill([...text, ...lines].join('\n'));
    await importing.getByRole('button', { name: 'Read pasted text' }).click();
    await importing
      .getByRole('button', { name: /^Import/ })
      .last()
      .click();
    await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();

    const sheets = page.locator('[data-preview-page-content]');
    await expect(sheets).toHaveCount(2);
    // Measurements settle a frame after the throttled render; wait for the last word to land.
    const lastWord = words(lines.at(-1)!).at(-1)!;
    await expect(sheets.last()).toContainText(lastWord);

    await page.getByRole('button', { name: 'Open export dialog' }).click();
    await page
      .getByRole('dialog', { name: 'Export' })
      .getByRole('button', { name: 'Save PDF' })
      .click();
    await expect(page.getByText(/^Saved .*\.pdf$/)).toBeVisible({ timeout: 15_000 });
    const file = fs.readdirSync(userDataDir).find((f) => f.endsWith('.pdf'))!;
    const pdfPages = (await readPdfPages(path.join(userDataDir, file))).map(
      ({ words: pageWords, lowest }) => {
        expect(lowest).toBeGreaterThan(MARGIN_BOTTOM_PT);
        return pageWords;
      }
    );

    const previewPages = await sheets.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).innerText)
    );
    const overflowing = await sheets.evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollHeight > node.clientHeight)
    );
    expect(overflowing).toHaveLength(0);
    expect(pdfPages.map((pageWords) => pageWords.slice(0, 3))).toEqual(
      previewPages.map((pageText) => words(pageText).slice(0, 3))
    );
    expect(pdfPages.map((pageWords) => pageWords.at(-1))).toEqual(
      previewPages.map((pageText) => words(pageText).at(-1))
    );
    expect(errors).toEqual([]);
  });
}
