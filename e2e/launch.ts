import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { startXvfb } from './startXvfb';

const APP_DIR = path.resolve(import.meta.dirname, '..');

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  /** A fresh profile per launch, so tests never touch the real ~/.config/Mosaic. */
  userDataDir: string;
  /** Console errors and uncaught exceptions from the renderer. */
  errors: string[];
}

export interface LaunchOptions {
  /**
   * The first-run tour starts over a fresh profile's first resume and would stand in front
   * of every test; only the tour's own tests want it.
   */
  showTour?: boolean;
}

type LaunchApp = (existingUserDataDir?: string, options?: LaunchOptions) => Promise<LaunchedApp>;

interface WorkerFixtures {
  workerDisplay: string | undefined;
  launchApp: LaunchApp;
}

/** Every launch, including manual relaunches, is bound to its worker's desktop. */
export const test = base.extend<object, WorkerFixtures>({
  workerDisplay: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixture dependencies.
    async ({}, runWithDisplay) => {
      if (process.platform !== 'linux') {
        await runWithDisplay(undefined);
        return;
      }
      const server = await startXvfb();
      try {
        await runWithDisplay(server.display);
      } finally {
        await server.stop();
      }
    },
    { scope: 'worker' },
  ],
  launchApp: [
    async ({ workerDisplay }, runWithLauncher) => {
      await runWithLauncher((existingUserDataDir, options) =>
        launchApp(workerDisplay, existingUserDataDir, options)
      );
    },
    { scope: 'worker' },
  ],
});

/**
 * Launches the built app (`out/`) — run `electron-vite build` first. Pass the
 * `userDataDir` of an earlier launch to relaunch over the same data.
 */
async function launchApp(
  workerDisplay: string | undefined,
  existingUserDataDir?: string,
  { showTour = false }: LaunchOptions = {}
): Promise<LaunchedApp> {
  if (process.platform === 'linux' && !workerDisplay) {
    throw new Error(
      'Electron E2E launches require the worker Xvfb fixture, never the host display'
    );
  }
  const userDataDir = existingUserDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-e2e-'));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  const args = [APP_DIR, `--user-data-dir=${userDataDir}`];
  if (process.platform === 'linux') {
    // Never inherit the host desktop, even when the test runner is itself under xvfb-run.
    env.DISPLAY = workerDisplay!;
    delete env.WAYLAND_DISPLAY;
    delete env.XAUTHORITY;
    args.push('--ozone-platform=x11');
    // No session bus, so no Secret Service: saving, testing, or erasing keys can never
    // reach the desktop's real keychain, and every run sees the no-keychain fallback.
    env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${path.join(userDataDir, 'no-session-bus')}`;
  }

  // Playwright otherwise adds --no-sandbox on Linux, masking sandbox regressions.
  const app = await electron.launch({ args, env, chromiumSandbox: true }).catch((error) => {
    if (!existingUserDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  if (!existingUserDataDir && !showTour) await markTourSeen(page);
  return { app, page, userDataDir, errors };
}

/** Stores the tour as seen, as finishing it would, and reloads so the app reads it. */
async function markTourSeen(page: Page) {
  await page.evaluate(() =>
    window.mosaic.db.settings.set(
      'ui',
      JSON.stringify({ state: { hasSeenTour: true }, version: 0 })
    )
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

/** Registers hooks that give each test in the file a freshly launched app. */
export function withApp(options?: LaunchOptions): () => LaunchedApp {
  let current: LaunchedApp | undefined;
  test.beforeEach(async ({ launchApp }) => {
    current = await launchApp(undefined, options);
  });
  test.afterEach(async () => {
    if (!current) return;
    await current.app.close();
    fs.rmSync(current.userDataDir, { recursive: true, force: true });
    current = undefined;
  });
  return () => {
    if (!current) throw new Error('The app is only available inside a test.');
    return current;
  };
}
