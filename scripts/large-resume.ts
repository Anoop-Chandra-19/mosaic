/**
 * The typing check's resumes, each a size it asks for, imported as pasted text: the same
 * fictional resume, cut short, as the profiles' worst case (`worstCaseResume.ts`). The other
 * checks load a profile instead.
 */
import { expect, type Page } from '@playwright/test';
import { largeResumeText } from '../src/renderer/src/features/dev-tools/profiles/worstCaseResume';

/** From the Start panel: a blank resume, then `text` imported into it. */
async function importResumeText(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByLabel('Or paste the text').fill(text);
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

/** From the Start panel: a blank resume, then one with `bullets` bullets imported into it. */
export function importLargeResume(page: Page, bullets: number): Promise<void> {
  return importResumeText(page, largeResumeText(bullets));
}
