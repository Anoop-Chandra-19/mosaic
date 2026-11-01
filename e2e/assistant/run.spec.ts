import { expect } from '@playwright/test';
import { runDevTool } from '../harness/devTools';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

test('a run on the scripted model reads the resume through the page and stages suggestions', async () => {
  const { page, errors } = mosaic();
  await runDevTool(page, 'exampleResume');
  await runDevTool(page, 'scriptedModel', { isOn: true });
  await runDevTool(page, 'askAgent', { text: 'Tighten my bullets.' });

  await expect(page.getByRole('button', { name: '2 suggestions waiting' })).toBeVisible();

  const pane = page.getByRole('complementary', { name: 'Assistant' });
  await expect(pane.getByText('2 suggestions ready to review')).toBeVisible();
  await pane.getByRole('button', { name: 'Open on the page' }).click();
  const review = page.getByRole('region', { name: 'Suggestion review' });
  const inspector = review.getByRole('complementary', { name: 'Suggestions' });
  await inspector.getByRole('button', { name: 'Keep', exact: true }).click();
  await review.getByRole('button', { name: 'Apply 1 suggestion' }).click();
  await inspector.getByRole('button', { name: 'Back to draft' }).click();
  await expect(review).toBeHidden();

  await expect(pane.getByText('1 suggestion ready to review')).toBeVisible();
  await pane.getByRole('button', { name: /Applied 1 of 2 suggestions/ }).click();
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
  expect(errors).toEqual([]);
});
