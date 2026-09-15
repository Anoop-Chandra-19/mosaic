import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
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

  await expect(importing.getByRole('listitem').filter({ hasText: 'Skills' })).toHaveText(
    'Skills — 2 lines'
  );
  const leftOut = importing.getByRole('button', { name: /^Left out/ });
  await expect(leftOut).toHaveText('Left out — 2 lines');
  await leftOut.click();
  await expect(
    importing.getByText('Writes programs for engines that do not exist yet')
  ).toBeVisible();

  await importing.getByRole('button', { name: 'Copy' }).click();
  await expect(importing.getByRole('button', { name: 'Copied' })).toBeVisible();
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  expect(copied).toBe('Writes programs for engines that do not exist yet\nCertifications');
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
