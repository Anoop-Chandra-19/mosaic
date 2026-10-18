import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { openWith, saveInto } from '../harness/dialogs';
import { test, withApp } from '../harness/launch';
import { extractPdfText } from '../harness/pdfText';
import { recordHeightAnimations } from '../harness/recordHeightAnimations';

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
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Save|Name) v\d/ })
    .click();
  await expect(page.getByText(`Named “${name}”`)).toBeVisible();
}

test('export appearance starts from document settings and cancelling leaves them unchanged', async () => {
  const { page, errors } = mosaic();
  await startFromSample(page);
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('navigation').getByRole('button', { name: 'Document' }).click();
  await settings.getByRole('radio', { name: 'US Letter' }).click();
  await settings.getByRole('radio', { name: 'Underlined' }).click();
  await settings.getByRole('radio', { name: 'Blue' }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();

  const exporting = await openExport(page, /^PDF/);
  await expect(exporting.getByRole('radio', { name: 'Letter', exact: true })).toBeChecked();
  await expect(exporting.getByRole('radio', { name: 'Underlined' })).toBeChecked();
  await expect(exporting.getByRole('radio', { name: 'Blue' })).toBeChecked();
  await exporting.getByRole('radio', { name: 'A4' }).click();
  await exporting.getByRole('radio', { name: 'Plain', exact: true }).click();
  await exporting.getByRole('radio', { name: 'Black' }).click();
  const linkedIn = page.locator('[data-preview-header] a', { hasText: 'LinkedIn' }).first();
  await expect(linkedIn).toHaveCSS('text-decoration-line', 'underline');
  await expect(linkedIn).toHaveCSS('color', 'rgb(5, 99, 193)');
  await exporting.getByRole('button', { name: 'Cancel' }).click();

  const again = await openExport(page, /^PDF/);
  await expect(again.getByRole('radio', { name: 'Letter', exact: true })).toBeChecked();
  await expect(again.getByRole('radio', { name: 'Underlined' })).toBeChecked();
  await expect(again.getByRole('radio', { name: 'Blue' })).toBeChecked();
  await again.getByRole('button', { name: 'Close export' }).click();
  const boot = await page.evaluate(() => window.mosaic.db.boot());
  if (!boot.ok) throw new Error(boot.message);
  expect(JSON.parse(boot.value.settings.ui).state.paperSize).toBe('letter');
  expect(errors).toEqual([]);
});

test('export eases format-driven height changes and skips them with reduced motion', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await startFromSample(page);
  const exporting = await openExport(page, /^PDF/);
  const tracked = await recordHeightAnimations(exporting);

  await exporting.getByRole('radio', { name: /^Markdown/ }).click();
  await expect
    .poll(() => tracked.evaluate(({ animations }) => animations.length))
    .toBeGreaterThan(0);
  await expect(exporting.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible();
  await expect(exporting.getByRole('radio', { name: 'A4' })).toHaveCount(0);
  await tracked.evaluate(async ({ animations }) => {
    for (const animation of animations) {
      if (animation.playState === 'running') animation.finish();
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
  const previousCount = await tracked.evaluate(({ animations }) => animations.length);
  await exporting.getByRole('radio', { name: /^PDF/ }).click();
  await expect
    .poll(() => tracked.evaluate(({ animations }) => animations.length))
    .toBeGreaterThan(previousCount);
  await tracked.evaluate(async ({ animations }) => {
    await Promise.all(animations.map((animation) => animation.finished));
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedCount = await tracked.evaluate(({ animations }) => animations.length);
  await exporting.getByRole('radio', { name: /^Markdown/ }).click();
  await expect(exporting.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible();
  await exporting.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  expect(await tracked.evaluate(({ animations }) => animations.length)).toBe(reducedCount);
  await tracked.evaluate(({ restore }) => restore());

  await page.setViewportSize({ width: 720, height: 650 });
  for (const format of [/^PDF/, /^Markdown/, /^Mosaic JSON/]) {
    await exporting.getByRole('radio', { name: format }).click();
    await expect(exporting.getByRole('button', { name: /^Save / })).toBeVisible();
    await expect
      .poll(() =>
        exporting.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const body = element.querySelector('.overflow-y-auto')!;
          return {
            isInViewport: bounds.top >= 0 && bounds.bottom <= innerHeight,
            hasHorizontalOverflow: body.scrollWidth > body.clientWidth,
          };
        })
      )
      .toEqual({ isInViewport: true, hasHorizontalOverflow: false });
  }
  await exporting.getByRole('button', { name: 'Close export' }).click();
  expect(errors).toEqual([]);
});

test('export keeps text width stable while its height changes', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await startFromSample(page);
  const exporting = await openExport(page, /^Markdown/);
  // The switch to Markdown eases the height from a resize observer, a frame after the click:
  // wait for that easing to start, then to land, so it isn't the one held below.
  await exporting.evaluate(async (element) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const body = exporting.locator('.overflow-y-auto');
  const widthBefore = await body.evaluate((element) => element.clientWidth);
  const held = await recordHeightAnimations(exporting, { isHeldAtStart: true });
  await exporting.getByRole('radio', { name: /^Word/ }).click();
  await expect.poll(() => held.evaluate(({ animations }) => animations.length)).toBeGreaterThan(0);
  // New content overflows the old height while the dialog is still growing.
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  expect(await body.evaluate((element) => element.clientWidth)).toBe(widthBefore);
  await held.evaluate(async ({ animations, restore }) => {
    restore();
    animations.forEach((animation) => animation.finish());
    await Promise.all(animations.map((animation) => animation.finished));
  });
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(false);
  expect(await body.evaluate((element) => element.clientWidth)).toBe(widthBefore);
  expect(errors).toEqual([]);
});

test('the filename uses spare row width without wrapping its label or extension', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFromSample(page);
  const exporting = await openExport(page, /^PDF/);
  const filename = exporting.getByLabel('File name');
  await filename.fill('Maren Rowan Vale - Dispatch Analyst - Lantern Works');

  for (const width of [1280, 720]) {
    await page.setViewportSize({ width, height: 700 });
    await expect
      .poll(() =>
        filename.evaluate((element) => {
          const field = element.parentElement!.getBoundingClientRect();
          const row = element.parentElement!.parentElement!;
          const label = row.firstElementChild!.getBoundingClientRect();
          const input = element.getBoundingClientRect();
          const extension = element.nextElementSibling!.getBoundingClientRect();
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
          return {
            isWider: field.width > 18 * rem && field.width <= 26 * rem,
            isAligned: Math.abs(label.top + label.height / 2 - (field.top + field.height / 2)) < 1,
            isExtensionAttached: Math.abs(input.right - extension.left) < 1,
            hasOverflow: row.scrollWidth > row.clientWidth,
          };
        })
      )
      .toEqual({ isWider: true, isAligned: true, isExtensionAttached: true, hasOverflow: false });
  }
  expect(errors).toEqual([]);
});

test('Markdown can be copied or saved, and reads back in through Import', async () => {
  const { app, page, userDataDir } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);

  await (
    await openExport(page, /^Markdown/)
  )
    .getByRole('button', { name: 'Copy to clipboard' })
    .click();
  await expect(page.getByText('Markdown copied')).toBeVisible();
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied).toMatch(/^# Your Name\n/);

  await (await openExport(page, /^Markdown/)).getByRole('button', { name: 'Save MD' }).click();
  await expect(page.getByText('Saved Your Name - Example resume.md')).toBeVisible();
  const file = path.join(userDataDir, 'Your Name - Example resume.md');
  expect(fs.readFileSync(file, 'utf8')).toBe(copied);

  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name - Example resume.md')).toBeVisible();
  // Headings come back as written, not renamed to a stock name.
  await expect(importing.getByRole('checkbox', { name: 'Import Work History' })).toBeChecked();
  await importing.getByRole('button', { name: 'Import as new template' }).click();

  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
  await expect(page.getByRole('banner').getByText('Your Name', { exact: true })).toBeVisible();
});

test('an export takes what is on the page, or everything the resume holds', async () => {
  const { app, page } = mosaic();
  await startFromSample(page);

  // Leave the first bullet off the resume; it stays in the sidebar either way.
  const bullet = page.getByRole('checkbox', { name: 'Toggle bullet visibility' }).first();
  await bullet.click();
  await expect(bullet).not.toBeChecked();

  // Emptied first, so what is read back is this copy rather than the one before it.
  const copyMarkdown = async (content: string) => {
    await app.evaluate(({ clipboard }) => clipboard.writeText(''));
    const exporting = await openExport(page, /^Markdown/);
    await exporting.getByRole('radio', { name: content }).click();
    await exporting.getByRole('button', { name: 'Copy to clipboard' }).click();
    return expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toMatch(/^# Your Name\n/);
  };

  const left = 'Worked in Agile sprints';
  await copyMarkdown('What’s on the page');
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).not.toContain(left);
  await copyMarkdown('Everything');
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain(left);
});

test('JSON Resume reads back in through Import with its own headings', async () => {
  const { app, page, userDataDir } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);

  await (await openExport(page, /^JSON Resume/)).getByRole('button', { name: 'Save JSON' }).click();
  await expect(page.getByText('Saved Your Name - Example resume.json')).toBeVisible();
  const file = path.join(userDataDir, 'Your Name - Example resume.json');
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).meta.mosaic.version).toBe(1);

  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name - Example resume.json')).toBeVisible();
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

  const exporting = await openExport(page, /^PDF/);
  await exporting.getByRole('radio', { name: 'Underlined' }).click();
  await exporting.getByRole('radio', { name: 'Blue' }).click();
  await exporting.getByRole('radio', { name: /^Mosaic JSON/ }).click();
  await exporting.getByRole('button', { name: 'Save JSON' }).click();
  await expect(page.getByText('Saved Ada Lovelace - Example resume.json')).toBeVisible();
  const file = path.join(userDataDir, 'Ada Lovelace - Example resume.json');
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(bundle.bundleVersion).toBe(3);
  const draft = bundle.docs[bundle.templates[0].draftDocId];
  expect(draft.contact.header.linkStyle).toBe('plain');
  expect(draft.contact.header.linkColor ?? 'ink').toBe('ink');
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
  await expect(dialog.getByRole('radio', { name: 'Underlined' })).toHaveCount(0);
  await expect(dialog.getByRole('radio', { name: 'Blue' })).toHaveCount(0);
  await expect(dialog.getByLabel('File name')).toHaveValue('Your Name - Example resume (v1)');
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
  await exporting.getByRole('radio', { name: 'Underlined' }).click();
  await exporting.getByRole('radio', { name: 'Blue' }).click();
  await exporting.getByRole('radio', { name: 'Letter', exact: true }).click();
  // Export-only overrides must not restyle the preview behind the dialog.
  const linkedIn = page.locator('[data-preview-header] a', { hasText: 'LinkedIn' }).first();
  await expect(linkedIn).toHaveCSS('text-decoration-line', 'none');
  await expect(linkedIn).toHaveCSS('color', 'rgb(0, 0, 0)');
  await exporting.getByRole('button', { name: 'Save PDF' }).click();

  // Named for the person and the template. If PDF generation breaks (e.g. the CSP blocks
  // react-pdf's Wasm) nothing is ever saved, so wait on the toast with a clear timeout.
  const file = path.join(userDataDir, 'Your Name - Example resume.pdf');
  await expect(page.getByText('Saved Your Name - Example resume.pdf')).toBeVisible({
    timeout: 15_000,
  });

  const pdf = fs.readFileSync(file);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toMatch(/\/MediaBox\s*\[0 0 612 792\]/);
  const text = extractPdfText(pdf);
  expect(text).toContain('Your Name');
  expect(text).toContain('Work History');
  await expect(linkedIn).toHaveCSS('text-decoration-line', 'none');
  await expect(linkedIn).toHaveCSS('color', 'rgb(0, 0, 0)');
  const again = await openExport(page, /^PDF/);
  await expect(again.getByRole('radio', { name: 'A4' })).toBeChecked();
  await expect(again.getByRole('radio', { name: 'Plain', exact: true })).toBeChecked();
  await expect(again.getByRole('radio', { name: 'Black' })).toBeChecked();
  await again.getByRole('button', { name: 'Close export' }).click();

  // pdf.js reads in a worker, which the content security policy has to let load.
  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name - Example resume.pdf')).toBeVisible();
  for (const [heading, holds] of [
    ['Education & Certificates', '2 entries'],
    ['Work History', '1 entry, 6 bullets'],
    ['Projects', '2 entries, 6 bullets'],
  ]) {
    await expect(importing.getByRole('checkbox', { name: `Import ${heading}` })).toBeChecked();
    await expect(importing.getByRole('listitem').filter({ hasText: heading })).toContainText(holds);
  }
  await expect(importing.getByRole('button', { name: /^Left out/ })).toHaveCount(0);
  // The blue underlines are read off the page, and the review says so.
  await importing.getByRole('button', { name: 'Contact' }).click();
  await expect(importing.getByRole('listitem').filter({ hasText: 'Contact' })).toContainText(
    'Links underlined and blue, as in the file.'
  );
  await importing.getByRole('button', { name: 'Import as new template' }).click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
  // The header's links come back from the PDF with the words they are set on, as they were.
  await expect(linkedIn).toHaveAttribute('href', 'https://linkedin.com/in/you');
  await expect(linkedIn).toHaveCSS('text-decoration-line', 'underline');
  await expect(linkedIn).toHaveCSS('color', 'rgb(5, 99, 193)');
  expect(errors).toEqual([]);
});

test('Save DOCX writes a Word file, which reads back in through Import', async () => {
  const { app, page, userDataDir, errors } = mosaic();
  await saveInto(app, userDataDir);
  await startFromSample(page);

  const exporting = await openExport(page, /^Word/);
  // Word shares PDF's export-only paper and link appearance options.
  await expect(exporting.getByRole('radio', { name: 'Letter' })).toBeVisible();
  await exporting.getByRole('radio', { name: 'Underlined' }).click();
  await exporting.getByRole('button', { name: 'Save DOCX' }).click();

  const file = path.join(userDataDir, 'Your Name - Example resume.docx');
  await expect(page.getByText('Saved Your Name - Example resume.docx')).toBeVisible();
  // A zip, as every .docx is.
  expect(fs.readFileSync(file).subarray(0, 4).toString('hex')).toBe('504b0304');

  await openWith(app, file);
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(importing.getByText('Your Name - Example resume.docx')).toBeVisible();
  for (const [heading, holds] of [
    ['Education & Certificates', '2 entries'],
    ['Work History', '1 entry, 6 bullets'],
    ['Projects', '2 entries, 6 bullets'],
  ]) {
    await expect(importing.getByRole('checkbox', { name: `Import ${heading}` })).toBeChecked();
    await expect(importing.getByRole('listitem').filter({ hasText: heading })).toContainText(holds);
  }
  await expect(importing.getByRole('button', { name: /^Left out/ })).toHaveCount(0);
  await importing.getByRole('button', { name: 'Contact' }).click();
  await expect(importing.getByRole('listitem').filter({ hasText: 'Contact' })).toContainText(
    'Links underlined, as in the file.'
  );
  expect(errors).toEqual([]);
});

test('a PDF export names the characters its font can’t draw, and a Word export doesn’t', async () => {
  const { page, errors } = mosaic();
  await startFromSample(page);
  const dialog = await openExport(page, /^PDF/);
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close export' }).click();

  await page.getByRole('complementary').getByText('Your Name', { exact: true }).click();
  await page.getByPlaceholder('Your name').fill('Łukasz Wójcik');
  await page.getByPlaceholder('Your name').press('Enter');

  const again = await openExport(page, /^PDF/);
  await expect(again.getByRole('status')).toContainText('The PDF can’t show Ł.');
  await again.getByRole('radio', { name: /^Word/ }).click();
  await expect(again.getByRole('status')).toHaveCount(0);
  expect(errors).toEqual([]);
});
