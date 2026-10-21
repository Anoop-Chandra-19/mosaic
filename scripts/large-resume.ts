/**
 * The hand-run checks' data: the fictional resumes the Heavy profile holds too
 * (`worstCaseResume.ts`), imported as pasted text, then as long a history as a check asks
 * for, across as many templates.
 */
import { expect, type Page } from '@playwright/test';
import type { DbResult } from '../src/shared/types/db';
import { largeResumeText } from '../src/renderer/src/features/dev-tools/profiles/worstCaseResume';

/** From the Start panel: a blank resume, then `text` imported into it. */
export async function importResumeText(page: Page, text: string): Promise<void> {
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

export interface HistoryShape {
  /** Versions of the open template. */
  versions: number;
  /** Other templates, each a copy of it named "Tailored for company N". */
  otherTemplates?: number;
  versionsPerOtherTemplate?: number;
}

/**
 * Builds history straight through the database, as real editing would leave it: each
 * version rewrites a few bullets in other words, every ninth adds one and every thirteenth
 * removes one, and every tenth is named. Then reloads, so the app reads it all as it would
 * at launch.
 */
export async function growHistory(page: Page, shape: HistoryShape): Promise<void> {
  await page.evaluate(async ({ versions, otherTemplates = 0, versionsPerOtherTemplate = 0 }) => {
    const db = window.mosaic.db;
    const unwrap = <T>(result: DbResult<T>): T => {
      if (!result.ok) throw new Error(result.message);
      return result.value;
    };
    const WORDS = [
      'dispatch',
      'queue',
      'ledger',
      'engine',
      'tables',
      'batch',
      'stream',
      'review',
      'budget',
      'rollout',
      'incident',
      'runbook',
      'migration',
      'forecast',
      'audit',
      'handover',
    ];
    const VERBS = ['Rebuilt', 'Cut', 'Led', 'Wrote', 'Shipped', 'Measured', 'Untangled'];
    const sentence = (seed: number) => {
      const words = Array.from(
        { length: 16 + (seed % 9) },
        (_, k) => WORDS[(seed * 31 + k * 17) % WORDS.length]
      );
      return `${VERBS[seed % VERBS.length]} the ${words.join(' ')}, ${seed % 97}% faster.`;
    };

    const edit = async (templateId: string, round: number) => {
      const draft = unwrap(await db.drafts.get(templateId));
      const entries = draft.doc.sections
        .flatMap((section) => section.items)
        .filter((item) => (item.bullets?.length ?? 0) > 0);
      for (const step of [7, 13, 29]) {
        const entry = entries[(round * step) % entries.length];
        entry.bullets[(round * step) % entry.bullets.length].text = sentence(round * step);
      }
      const target = entries[round % entries.length];
      if (round % 9 === 0) {
        target.bullets.push({ id: crypto.randomUUID(), text: sentence(round), selected: true });
      }
      if (round % 13 === 0 && target.bullets.length > 2) target.bullets.splice(1, 1);
      unwrap(await db.drafts.save(templateId, draft.doc, draft.rev));
      unwrap(
        await (round % 10 === 0
          ? db.versions.name(templateId, `Round ${round}`, 'new')
          : db.versions.snapshot(templateId, 'edit'))
      );
    };

    const openId = unwrap(await db.boot()).draft!.templateId;
    for (let round = 1; round <= versions; round++) await edit(openId, round);
    for (let copy = 1; copy <= otherTemplates; copy++) {
      const { id } = unwrap(await db.templates.duplicate(openId));
      unwrap(await db.templates.rename(id, `Tailored for company ${copy}`));
      for (let round = 1; round <= versionsPerOtherTemplate; round++) await edit(id, round);
    }
    // Leave the large one open, with its own history as the newest edits.
    unwrap(await db.templates.open(openId));
  }, shape);
  await page.reload();
  await expect(page.locator('[data-preview-page-content]').first()).toBeVisible();
}
