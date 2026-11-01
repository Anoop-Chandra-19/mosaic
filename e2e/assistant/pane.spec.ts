import { expect, type Page } from '@playwright/test';
import { runDevTool } from '../harness/devTools';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

/** AI is turned on and off in one place only: Settings. */
async function setAiEnabled(page: Page, on: boolean) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  const toggle = settings.getByRole('switch', { name: 'Enable AI assistant' });
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
}

test('the assistant pane appears on the right only while AI is on', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const pane = page.getByRole('complementary', { name: 'Assistant' });

  // AI is off by default, and then nothing in the window points at it.
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI Tools' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle assistant' })).toHaveCount(0);
  await expect(page.getByText(/\bAI\b/)).toHaveCount(0);

  await setAiEnabled(page, true);
  await expect(pane).toBeVisible();
  await expect(pane.getByText(/Ask for a change in your own words/)).toBeVisible();
  await expect(pane.getByText('OpenAI · gpt-5.6-terra')).toBeVisible();

  // It sits right of the preview.
  const previewBox = await page.getByRole('main').boundingBox();
  const paneBox = await pane.boundingBox();
  expect(paneBox!.x).toBeGreaterThanOrEqual(previewBox!.x + previewBox!.width - 1);

  // Closed and reopened: the ✕, the shortcut, and the status bar's toggle.
  await pane.getByRole('button', { name: 'Close assistant' }).click();
  await expect(pane).toHaveCount(0);
  await page.keyboard.press('Control+Backslash');
  await expect(pane).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Toggle assistant' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(pane).toHaveCount(0);
  await toggle.click();
  await expect(pane).toBeVisible();

  // The footer's link goes to the AI settings; turning AI off there takes the pane away.
  await pane.getByRole('button', { name: 'change' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle assistant' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('asking in the prompt box shows the ask and the reply, and the box is ready again', async () => {
  const { page, errors } = mosaic();
  await runDevTool(page, 'exampleResume');
  await runDevTool(page, 'scriptedModel', { isOn: true });
  await setAiEnabled(page, true);
  const pane = page.getByRole('complementary', { name: 'Assistant' });
  const box = pane.getByRole('textbox', { name: 'Message' });

  await box.fill('Tighten my bullets.');
  await box.press('Enter');

  const conversation = pane.getByRole('region', { name: 'Conversation' });
  await expect(conversation.getByText('Tighten my bullets.')).toBeVisible();
  await expect(conversation.getByText('Done. They’re waiting for your review.')).toBeVisible();
  await expect(box).toHaveValue('');
  await expect(pane.getByRole('button', { name: 'Send' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2 suggestions waiting' })).toBeVisible();

  // One step is that step by name; two fold into a line that opens on what they did, named from
  // what each call was about. The run's total comes once, at the end.
  await expect(conversation.getByText('Read your resume')).toBeVisible();
  const runLine = conversation.getByRole('button', { name: /^2 steps/ });
  await expect(runLine).toHaveAttribute('aria-expanded', 'false');
  await runLine.click();
  await expect(conversation.getByText('Rewrote a bullet')).toBeVisible();
  await expect(conversation.getByText(/^3 steps/)).toBeVisible();
  await expect(conversation.getByText('Harbor Freight Labs · 1st bullet')).toBeVisible();

  // The Trace holds the record of the same run, its result read as the row opens. Esc comes back.
  await pane.getByRole('tab', { name: /^Trace/ }).click();
  const trace = pane.getByRole('region', { name: 'Trace' });
  await expect(conversation).toBeHidden();
  await trace.getByRole('button', { name: /^Read your resume/ }).click();
  await expect(trace.getByText('Arguments')).toBeVisible();
  await expect(trace.getByText('Result', { exact: true })).toBeVisible();
  await expect(trace.getByText('Loading the result')).toHaveCount(0);
  await expect(trace.locator('pre').last()).not.toBeEmpty();
  await trace.getByRole('button', { name: /^Read your resume/ }).press('Escape');
  await expect(conversation).toBeVisible();
  await expect(trace).toHaveCount(0);

  await pane.getByRole('button', { name: 'New conversation' }).click();
  await expect(conversation.getByText('Tighten my bullets.')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a long conversation opens on its newest, reads back to its first holding your place, and a send comes back', async () => {
  const { page, errors } = mosaic();
  await runDevTool(page, 'exampleResume');
  await runDevTool(page, 'longConversation', { messages: 800 });
  const conversation = page.getByRole('region', { name: 'Conversation' });
  await expect(conversation.getByText('What stands out in part 200?')).toHaveCount(1);
  await expect
    .poll(() =>
      conversation.evaluate(
        ({ scrollHeight, scrollTop, clientHeight }) => scrollHeight - scrollTop - clientHeight
      )
    )
    .toBeLessThan(2);
  await expect(conversation.getByText('What stands out in part 1?')).toHaveCount(0);

  // At the very top, the place held is what was first on screen, not what landed above it.
  const firstRead = conversation.getByText('What stands out in part', { exact: false }).first();
  const firstReadText = await firstRead.innerText();
  await conversation.evaluate((element) => element.scrollTo({ top: 0 }));
  await expect.poll(() => conversation.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(
    conversation.getByText('What stands out in part', { exact: false }).first()
  ).not.toHaveText(firstReadText);
  await expect(conversation.getByText(firstReadText)).toBeInViewport();

  await expect(async () => {
    await conversation.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(conversation.getByText('What stands out in part 1?')).toBeInViewport({
      timeout: 200,
    });
  }).toPass();
  // Far from the newest, which has gone until it is wanted again.
  await expect(conversation.getByText('What stands out in part 200?')).toHaveCount(0);

  await runDevTool(page, 'scriptedModel', { isOn: true });
  const box = page
    .getByRole('complementary', { name: 'Assistant' })
    .getByRole('textbox', { name: 'Message' });
  await box.fill('Tighten my bullets.');
  await box.press('Enter');
  await expect(conversation.getByText('Done. They’re waiting for your review.')).toBeInViewport();
  await expect(conversation.getByText('What stands out in part 200?')).toHaveCount(1);
  await expect(conversation.getByText('What stands out in part 1?')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('far back in a long conversation, a run that stops still says so, and a button goes back', async () => {
  const { app, page, errors } = mosaic();
  // A server that holds the request until told, then refuses it.
  await app.evaluate(({ net }) => {
    const held = globalThis as unknown as { refuseRequest?: () => void };
    net.fetch = async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/v1/models')) return Response.json({ data: [] });
      await new Promise<void>((resolve) => (held.refuseRequest = resolve));
      return Response.json({ error: { message: 'Not today.' } }, { status: 400 });
    };
  });
  await runDevTool(page, 'exampleResume');
  await runDevTool(page, 'longConversation', { messages: 800 });
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  await settings.getByRole('button', { name: 'Provider' }).click();
  await page.getByRole('menuitemradio', { name: /^OpenAI-compatible/ }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();

  const pane = page.getByRole('complementary', { name: 'Assistant' });
  const conversation = pane.getByRole('region', { name: 'Conversation' });
  await expect(conversation.getByText('What stands out in part 200?')).toHaveCount(1);
  await expect(pane.getByRole('button', { name: /^Go to the newest/ })).toHaveCount(0);

  const box = pane.getByRole('textbox', { name: 'Message' });
  await box.fill('Tighten my summary.');
  await box.press('Enter');
  await expect(pane.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(conversation.getByText('Tighten my summary.')).toBeVisible();

  await expect(async () => {
    await conversation.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(conversation.getByText('What stands out in part 200?')).toHaveCount(0, {
      timeout: 200,
    });
  }).toPass();
  await expect(pane.getByRole('button', { name: 'Go to the newest. Working' })).toBeVisible();

  await app.evaluate(() =>
    (globalThis as unknown as { refuseRequest: () => void }).refuseRequest()
  );
  await expect(pane.getByRole('status')).toContainText('The server refused the request.');
  await expect(conversation.getByText('Tighten my summary.')).toHaveCount(0);

  const newest = pane.getByRole('button', { name: 'Go to the newest. New' });
  await newest.click();
  await expect(conversation.getByText('Tighten my summary.')).toBeInViewport();
  await expect(newest).toHaveCount(0);
  await expect(pane.getByRole('status')).toContainText('The server refused the request.');
  expect(errors).toEqual([]);
});

test('a very long error leaves the prompt box and its way forward in reach, even in a short window', async () => {
  const { app, page, errors } = mosaic();
  // Stand in for a server that refuses with far more words than fit.
  await app.evaluate(({ net }) => {
    net.fetch = async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/v1/models')) return Response.json({ data: [] });
      const message = 'The server has a great deal to say about this.\n'.repeat(200);
      return Response.json({ error: { message } }, { status: 400 });
    };
  });
  await runDevTool(page, 'exampleResume');
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Provider' }).click();
  await page.getByRole('menuitemradio', { name: /^OpenAI-compatible/ }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();

  const pane = page.getByRole('complementary', { name: 'Assistant' });
  const box = pane.getByRole('textbox', { name: 'Message' });
  await box.fill('Tighten my summary.');
  await box.press('Enter');
  const notice = pane.getByRole('status');
  await expect(notice).toContainText('The server refused the request.');

  const paneBottom = async () => {
    const paneBox = await pane.boundingBox();
    return paneBox!.y + paneBox!.height;
  };
  const expectInPane = async (control: ReturnType<typeof pane.getByRole>) => {
    await control.scrollIntoViewIfNeeded();
    const controlBox = await control.boundingBox();
    expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(await paneBottom());
  };
  const send = pane.getByRole('button', { name: 'Send', exact: true });
  const sendAgain = pane.getByRole('button', { name: 'Send again' });
  const quoted = notice.getByText(/great deal to say/);

  // The message scrolls by itself, so the notice stays a size that fits beside the rest.
  expect(await quoted.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true
  );
  await expectInPane(send);
  await expectInPane(sendAgain);

  // The smallest window: the notice gives way, never the box or the conversation's floor.
  await page.setViewportSize({ width: 800, height: 540 });
  await expectInPane(send);
  await expectInPane(sendAgain);
  await expect(box).toBeInViewport({ ratio: 1 });
  const conversation = await pane.getByRole('region', { name: 'Conversation' }).boundingBox();
  expect(conversation!.height).toBeGreaterThanOrEqual(120);
  expect(errors).toEqual([]);
});

test('on a narrow window the assistant lies over the preview instead of squeezing it', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setAiEnabled(page, true);
  const pane = page.getByRole('complementary', { name: 'Assistant' });

  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(pane).toHaveCSS('position', 'relative');

  await page.setViewportSize({ width: 800, height: 700 });
  await expect(pane).toHaveCSS('position', 'absolute');
  // The preview keeps the room the sidebar leaves it.
  const previewBox = await page.getByRole('main').boundingBox();
  expect(previewBox!.width).toBeGreaterThan(400);
});
