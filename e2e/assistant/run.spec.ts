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
  expect(errors).toEqual([]);
});
