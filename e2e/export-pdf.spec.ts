import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { withApp } from './launch';
import { extractPdfText } from './pdfText';

const mosaic = withApp();

test('Save PDF writes the resume as a real PDF', async () => {
  const { app, page, userDataDir } = mosaic();

  // Catch the download in the main process and save it into the test's own profile.
  const download = app.evaluate(
    ({ session }, dir) =>
      new Promise<{ state: string; file: string }>((resolve) => {
        session.defaultSession.once('will-download', (_event, item) => {
          item.setSavePath(`${dir}/${item.getFilename()}`);
          item.once('done', (_done, state) => resolve({ state, file: item.getSavePath() }));
        });
      }),
    userDataDir
  );

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save PDF' }).click();

  // If PDF generation breaks (e.g. the CSP blocks react-pdf's Wasm) no download ever
  // starts, so fail with that instead of waiting out the test timeout.
  const { state, file } = await Promise.race([
    download,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Save PDF did not produce a download within 15s')), 15_000)
    ),
  ]);
  expect(state).toBe('completed');
  expect(path.basename(file)).toMatch(/^your-name-resume-a4-\d{8}\.pdf$/);
  await expect(page.getByText(/Saved PDF: your-name-resume/)).toBeVisible();

  const pdf = fs.readFileSync(file);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const text = extractPdfText(pdf);
  expect(text).toContain('Your Name');
  expect(text).toContain('Work History');
});
