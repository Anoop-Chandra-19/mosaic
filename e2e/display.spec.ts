import fs from 'node:fs';
import { expect } from '@playwright/test';
import { test } from './launch';
import { startXvfb } from './startXvfb';

test.skip(process.platform !== 'linux', 'Xvfb desktop isolation is Linux-only');

test('Xvfb allocates distinct ready displays and cleans up its exit handlers', async () => {
  const exitListeners = process.listenerCount('exit');
  const first = await startXvfb();
  try {
    const second = await startXvfb();
    try {
      expect(first.display).not.toBe(second.display);
      for (const server of [first, second]) {
        expect(server.display).toMatch(/^:\d+$/);
        expect(fs.statSync(`/tmp/.X11-unix/X${server.display.slice(1)}`).isSocket()).toBe(true);
      }
    } finally {
      await second.stop();
    }
  } finally {
    await first.stop();
  }
  await first.stop(); // Teardown is safe even if an earlier cleanup already ran.
  expect(process.listenerCount('exit')).toBe(exitListeners);
});

test('missing Xvfb fails clearly without leaving an exit handler', async () => {
  const originalPath = process.env.PATH;
  const exitListeners = process.listenerCount('exit');
  try {
    process.env.PATH = '';
    await expect(startXvfb()).rejects.toThrow(/Could not start Xvfb:.*ENOENT/);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  }
  expect(process.listenerCount('exit')).toBe(exitListeners);
});

test('Electron uses its worker desktop instead of inherited display settings', async ({
  launchApp,
  workerDisplay,
}) => {
  const inherited = {
    DISPLAY: process.env.DISPLAY,
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY,
    XAUTHORITY: process.env.XAUTHORITY,
  };
  try {
    process.env.DISPLAY = ':987654';
    process.env.WAYLAND_DISPLAY = 'mosaic-test-host-wayland';
    process.env.XAUTHORITY = '/nonexistent/mosaic-test-host-authority';
    const { app, userDataDir } = await launchApp();
    try {
      const desktop = await app.evaluate(() => ({
        display: process.env.DISPLAY,
        waylandDisplay: process.env.WAYLAND_DISPLAY,
        authority: process.env.XAUTHORITY,
      }));
      expect(workerDisplay).toMatch(/^:\d+$/);
      expect(desktop).toEqual({
        display: workerDisplay,
        waylandDisplay: undefined,
        authority: undefined,
      });
    } finally {
      await app.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  } finally {
    for (const [key, value] of Object.entries(inherited)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
