/**
 * Opens each generated resume in the built app, records the words on every preview page,
 * and saves its PDF and Word file for `comparePageBreaks.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { saveInto } from '../../e2e/dialogs';
import { test, withApp } from '../../e2e/launch';
import { generateSweepResumes } from './generateSweepResumes';
import { runDirectory, SWEEP_COUNT, SWEEP_SEED } from './sweepOptions';

const mosaic = withApp();
const RESUMES_PER_TEST = 10;
const resumes = generateSweepResumes(SWEEP_SEED, SWEEP_COUNT);
const outDir = runDirectory(SWEEP_SEED);

async function saveExport(
  page: ReturnType<ReturnType<typeof withApp>>['page'],
  folder: string,
  format: 'PDF' | 'DOCX'
): Promise<string> {
  const before = new Set(fs.readdirSync(folder));
  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const exporting = page.getByRole('dialog', { name: 'Export' });
  await exporting.getByRole('radio', { name: format === 'PDF' ? /PDF/ : /Word/ }).click();
  await exporting.getByRole('button', { name: `Save ${format}` }).click();
  await expect(page.getByText(new RegExp(`^Saved .*\\.${format.toLowerCase()}$`))).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('dialog', { name: 'Export' })).toBeHidden();
  const saved = fs.readdirSync(folder).find((name) => !before.has(name))!;
  return path.join(folder, saved);
}

for (let start = 0; start < resumes.length; start += RESUMES_PER_TEST) {
  const batch = resumes.slice(start, start + RESUMES_PER_TEST);
  test(`resumes ${start} to ${start + batch.length - 1}`, async () => {
    test.setTimeout(batch.length * 20_000);
    const { app, page, userDataDir } = mosaic();
    const exportsDir = path.join(userDataDir, 'exports');
    fs.mkdirSync(exportsDir);
    fs.mkdirSync(outDir, { recursive: true });
    await saveInto(app, exportsDir);
    await page.getByRole('button', { name: /Blank resume/ }).click();

    let previousId: string | null = null;
    for (const resume of batch) {
      const templateId = await page.evaluate(
        async ({ doc, name }) => {
          const made = await window.mosaic.db.templates.create(name, doc as never);
          if (!made.ok) throw new Error(made.message);
          return made.value.id;
        },
        { doc: resume.doc, name: resume.id }
      );
      await page.reload();
      await page.getByRole('tab', { name: 'Templates' }).click();
      // The innermost box holding this template's options is its row of actions.
      await page
        .locator('div')
        .filter({ has: page.getByRole('button', { name: `Options for ${resume.id}` }) })
        .last()
        .getByRole('button', { name: 'Open', exact: true })
        .click();
      await expect(page.locator('[data-preview-header]').first()).toContainText(
        resume.doc.contact.name
      );
      if (previousId) {
        await page.evaluate((id) => window.mosaic.db.templates.remove(id), previousId);
      }
      previousId = templateId;

      await page
        .getByRole('radio', {
          name: `Switch paper size to ${resume.paper === 'a4' ? 'A4' : 'US Letter'}`,
        })
        .click();

      // The first layout uses estimates; wait until the measured one has settled.
      const readPreviewPages = () =>
        page
          .locator('[data-preview-page-content]')
          .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).innerText));
      let previewPages = await readPreviewPages();
      await expect(async () => {
        await page.waitForTimeout(250);
        const next = await readPreviewPages();
        const isSettled = JSON.stringify(next) === JSON.stringify(previewPages);
        previewPages = next;
        expect(isSettled).toBe(true);
      }).toPass({ timeout: 10_000 });

      for (const format of ['PDF', 'DOCX'] as const) {
        // Copied, not renamed: the profile is on another filesystem.
        const saved = await saveExport(page, exportsDir, format);
        fs.copyFileSync(saved, path.join(outDir, `${resume.id}.${format.toLowerCase()}`));
        fs.rmSync(saved);
      }
      fs.writeFileSync(
        path.join(outDir, `${resume.id}.json`),
        JSON.stringify({ ...resume, previewPages }, null, 2)
      );
    }
  });
}
