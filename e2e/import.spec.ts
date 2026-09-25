import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { buildPdf } from '../src/renderer/src/features/import/readers/pdf/__tests__/buildPdf';
import { openWith } from './dialogs';
import { withApp } from './launch';

const mosaic = withApp();

test('the review lists what Mosaic found no place for, ready to copy', async () => {
  const { app, page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing
    .getByLabel('Or paste the text')
    .fill(
      [
        'Ada Lovelace',
        'Writes programs for engines that do not exist yet',
        'ada@example.com',
        '',
        'Certifications',
        '',
        'Skills',
        'Mathematics',
        'Punched cards',
      ].join('\n')
    );
  await importing.getByRole('button', { name: 'Read pasted text' }).click();

  await expect(importing.getByRole('listitem').filter({ hasText: 'Skills' })).toContainText(
    '2 lines'
  );
  // A sentence under the name isn't contact information: it is left out, to place.
  await expect(importing.getByRole('listitem').filter({ hasText: 'Contact' })).toContainText(
    'Name, 1 line'
  );
  // Open already, since a line in it could go on the page.
  await expect(importing.getByRole('button', { name: /^Left out/ })).toContainText('2 lines');
  await expect(importing.getByText('Under no heading')).toBeVisible();
  await expect(importing.getByText('Certifications', { exact: true })).toBeVisible();

  await importing.getByRole('button', { name: 'Copy' }).click();
  await expect(importing.getByRole('button', { name: 'Copied' })).toBeVisible();
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied).toBe('Writes programs for engines that do not exist yet\nCertifications');
});

test('the review drops what was misread, places what was left out, and shows the file', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing
    .getByLabel('Or paste the text')
    .fill(
      [
        'Ada Lovelace',
        'ada@example.com',
        'Speaker at the Royal Society on engines that compose music.',
        '',
        'EXPERIENCE',
        'Analyst | 1842',
        '- Wrote the first program',
        '- Corrected the tables',
        'Tutor | 1840',
        '- Taught logic',
        '',
        'SKILLS',
        'Mathematics',
        'Python ●●●●○',
      ].join('\n')
    );
  await importing.getByRole('button', { name: 'Read pasted text' }).click();

  // Drop an entry and a bullet; the count says what is left of what was read.
  const experience = importing.getByRole('listitem').filter({ hasText: 'Experience' });
  await experience.getByRole('button', { name: 'Experience' }).click();
  await experience.getByRole('checkbox', { name: 'Keep Tutor' }).click();
  await experience.getByRole('checkbox', { name: 'Keep this bullet' }).nth(1).click();
  await expect(experience).toContainText('1 entry, 1 bullet of 2 entries');

  // Place both left-out lines, each where it belongs.
  await importing.getByRole('button', { name: 'Add to' }).first().click();
  await page.getByRole('menuitem', { name: 'Experience, as an entry' }).click();
  await importing.getByRole('button', { name: 'Add to' }).click();
  await page.getByRole('menuitem', { name: 'Skills, as a line' }).click();
  await expect(importing.getByText('→ Skills, as a line')).toBeVisible();
  await expect(importing.getByRole('button', { name: /^Left out/ })).toContainText('2 placed');

  // The file's own lines beside what they became.
  const skills = importing.getByRole('listitem').filter({ hasText: 'Skills' });
  await skills.getByRole('button', { name: 'Skills' }).click();
  await skills.getByRole('button', { name: 'Source' }).click();
  await expect(skills.getByText('In the file')).toBeVisible();
  await expect(skills.getByText('Mathematics')).toHaveCount(2);

  await importing.getByRole('button', { name: 'How to import' }).click();
  await page.getByRole('menuitemradio', { name: /^Replace/ }).click();
  await expect(importing.getByRole('button', { name: 'Replace resume' })).toBeVisible();
  await importing.getByRole('button', { name: 'How to import' }).click();
  await page.getByRole('menuitemradio', { name: /^New template/ }).click();
  await expect(importing).toContainText('2 sections · 2 entries · 1 bullet · 2 lines');
  await importing.getByRole('button', { name: 'Import as new template' }).click();

  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
  const preview = page.locator('article').first();
  await expect(preview).toContainText(
    'Speaker at the Royal Society on engines that compose music.'
  );
  await expect(preview).toContainText('Python');
  await expect(preview).not.toContainText('Tutor');
  await expect(preview).not.toContainText('Corrected the tables');
});

test('a PDF with no text in it is explained as probably a scan', async () => {
  const { app, page, userDataDir } = mosaic();
  const file = path.join(userDataDir, 'scanned.pdf');
  fs.writeFileSync(file, buildPdf());
  await openWith(app, file);

  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();

  await expect(importing.getByRole('alert')).toHaveText(
    'scanned.pdf has no text in it, so it is probably a scan. Paste the text instead.'
  );
});

test('a file Import can’t read is explained in the dialog, and nothing is written', async () => {
  const { app, page, userDataDir } = mosaic();
  const file = path.join(userDataDir, 'resume.pages');
  fs.writeFileSync(file, 'not a resume Mosaic can read');
  await openWith(app, file);

  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByRole('button', { name: 'Choose a file…' }).click();

  await expect(importing.getByRole('alert')).toHaveText(
    'Mosaic can’t read resume.pages yet. Paste its text instead.'
  );
  // Still on the first step, with nothing imported.
  await expect(importing.getByRole('button', { name: 'Read pasted text' })).toBeVisible();
  const templates = await page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return boot.value.templates.length;
  });
  expect(templates).toBe(1);
});
