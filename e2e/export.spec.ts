import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openWith, saveInto } from './dialogs';
import { withApp } from './launch';
import { extractPdfText } from './pdfText';

const mosaic = withApp();

async function startFromSample(page: Page) {
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  await expect(page.getByRole('banner').getByText('Example resume')).toBeVisible();
}

async function openExport(page: Page, format: RegExp, title = 'Export') {
  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.getByRole('radio', { name: format }).click();
  return dialog;
}

async function nameVersion(page: Page, name: string) {
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${name}”`)).toBeVisible();
}

test('Markdown can be copied or saved, and reads back in through Import', async () => {
  const { app, page, userDataDir } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);

  await (await openExport(page, /^Markdown/))
    .getByRole('button', { name: 'Copy to clipboard' })
    .click();
  await expect(page.getByText('Markdown copied')).toBeVisible();
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied).toMatch(/^# Your Name\n/);

  await (await openExport(page, /^Markdown/)).getByRole('button', { name: 'Save MD' }).click();
  await expect(page.getByText('Saved Your Name — Example resume.md')).toBeVisible();
  const file = path.join(userDataDir, 'Your Name — Example resume.md');
  expect(fs.readFileSync(file, 'utf8')).toBe(copied);

  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name — Example resume.md')).toBeVisible();
  // Headings come back as written, not renamed to a stock name.
  await expect(importing.getByRole('checkbox', { name: 'Import Work History' })).toBeChecked();
  await importing.getByRole('button', { name: 'Import as new template' }).click();

  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
  await expect(page.getByRole('banner').getByText('Your Name', { exact: true })).toBeVisible();
});

test('JSON Resume reads back in through Import with its own headings', async () => {
  const { app, page, userDataDir } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);

  await (await openExport(page, /^JSON Resume/)).getByRole('button', { name: 'Save JSON' }).click();
  await expect(page.getByText('Saved Your Name — Example resume.json')).toBeVisible();
  const file = path.join(userDataDir, 'Your Name — Example resume.json');
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).meta.mosaic.version).toBe(1);

  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name — Example resume.json')).toBeVisible();
  // meta.mosaic brings back the headings as written, not JSON Resume's stock names.
  for (const heading of ['Education & Certificates', 'Work History', 'Projects']) {
    await expect(importing.getByRole('checkbox', { name: `Import ${heading}` })).toBeChecked();
  }
  await importing.getByRole('button', { name: 'Import as new template' }).click();

  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
});

test('Mosaic JSON holds the template’s history and restores like a backup', async () => {
  const { app, page, userDataDir } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);
  // An edit first, so naming adds a version rather than naming the first one.
  await page.getByRole('complementary').getByText('Your Name', { exact: true }).click();
  await page.getByPlaceholder('Your name').fill('Ada Lovelace');
  await page.getByPlaceholder('Your name').press('Enter');
  await nameVersion(page, 'Sent to Acme');

  await (await openExport(page, /^Mosaic JSON/)).getByRole('button', { name: 'Save JSON' }).click();
  await expect(page.getByText('Saved Ada Lovelace — Example resume.json')).toBeVisible();
  const file = path.join(userDataDir, 'Ada Lovelace — Example resume.json');
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(bundle.bundleVersion).toBe(2);
  expect(bundle.templates[0].versions.map((v: { summary: string }) => v.summary)).toEqual([
    'Created',
    'Sent to Acme',
  ]);

  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  await page
    .getByRole('dialog', { name: 'Import' })
    .getByRole('button', { name: 'Choose a file…' })
    .click();
  await page
    .getByRole('dialog', { name: 'Restore a backup' })
    .getByRole('button', { name: 'Add 1 template' })
    .click();
  await expect(page.getByText('Added 1 template from the backup')).toBeVisible();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByRole('button', { name: 'Options for Example resume' })).toHaveCount(2);
});

test('a version exports as it was, not as the draft', async () => {
  const { app, page } = mosaic();
  await startFromSample(page);
  await nameVersion(page, 'Sent to Acme');
  await page.getByRole('complementary').getByText('Your Name', { exact: true }).click();
  await page.getByPlaceholder('Your name').fill('Ada Lovelace');
  await page.getByPlaceholder('Your name').press('Enter');

  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Export this version' }).click();
  // Naming the untouched sample named its first version.
  const dialog = page.getByRole('dialog', { name: 'Export v1' });
  // A single version has no history to carry, so there is no Mosaic JSON for it.
  await expect(dialog.getByRole('radio', { name: /^Mosaic JSON/ })).toHaveCount(0);
  await expect(dialog.getByLabel('File name')).toHaveValue('Your Name — Example resume (v1)');
  await dialog.getByRole('radio', { name: /^Plain text/ }).click();
  await dialog.getByRole('button', { name: 'Copy to clipboard' }).click();

  await expect(page.getByText('Plain text copied')).toBeVisible();
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied).toContain('Your Name');
  expect(copied).not.toContain('Ada Lovelace');
});

test('Save PDF writes the resume as a real PDF, which reads back in through Import', async () => {
  const { app, page, userDataDir, errors } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);

  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const exporting = page.getByRole('dialog', { name: 'Export' });
  // How the header's links look is the resume's own setting, so the preview follows it.
  await exporting.getByRole('radio', { name: 'Underlined' }).click();
  // Found by its text: behind an open dialog, the page is hidden from role queries.
  const linkedIn = page.locator('[data-preview-header] a', { hasText: 'LinkedIn' }).first();
  await expect(linkedIn).toHaveCSS('text-decoration-line', 'underline');
  await exporting.getByRole('button', { name: 'Save PDF' }).click();

  // Named for the person and the template. If PDF generation breaks (e.g. the CSP blocks
  // react-pdf's Wasm) nothing is ever saved, so wait on the toast with a clear timeout.
  const file = path.join(userDataDir, 'Your Name — Example resume.pdf');
  await expect(page.getByText('Saved Your Name — Example resume.pdf')).toBeVisible({
    timeout: 15_000,
  });

  const pdf = fs.readFileSync(file);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const text = extractPdfText(pdf);
  expect(text).toContain('Your Name');
  expect(text).toContain('Work History');

  // pdf.js reads in a worker, which the content security policy has to let load.
  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name — Example resume.pdf')).toBeVisible();
  for (const [heading, holds] of [
    ['Education & Certificates', '2 entries'],
    ['Work History', '1 entry, 6 bullets'],
    ['Projects', '2 entries, 6 bullets'],
  ]) {
    await expect(importing.getByRole('checkbox', { name: `Import ${heading}` })).toBeChecked();
    await expect(importing.getByRole('listitem').filter({ hasText: heading })).toContainText(holds);
  }
  await expect(importing.getByRole('button', { name: /^Left out/ })).toHaveCount(0);
  // The underlines are read off the page, and the review says so.
  await expect(importing.getByRole('listitem').filter({ hasText: 'Contact' })).toContainText(
    'Links underlined, as in the file.'
  );
  await importing.getByRole('button', { name: 'Import as new template' }).click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
  // The header's links come back from the PDF with the words they are set on, underlined.
  await expect(linkedIn).toHaveAttribute('href', 'https://linkedin.com/in/you');
  await expect(linkedIn).toHaveCSS('text-decoration-line', 'underline');
  expect(errors).toEqual([]);
});
