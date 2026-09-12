import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, test, type ElectronApplication, type Page } from '@playwright/test';

const APP_DIR = path.resolve(import.meta.dirname, '..');

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  /** A fresh profile per launch, so tests never touch the real ~/.config/Mosaic. */
  userDataDir: string;
  /** Console errors and uncaught exceptions from the renderer. */
  errors: string[];
}

/** Launches the built app (`out/`) — run `electron-vite build` first. */
export async function launchApp(): Promise<LaunchedApp> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-e2e-'));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  const args = [APP_DIR, `--user-data-dir=${userDataDir}`];
  if (process.platform === 'linux') {
    // Headless runs use xvfb, an X server. Left alone, Electron prefers the desktop's
    // Wayland session and opens a real window on it.
    delete env.WAYLAND_DISPLAY;
    args.push('--ozone-platform=x11');
  }

  const app = await electron.launch({ args, env });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  return { app, page, userDataDir, errors };
}

/** Registers hooks that give each test in the file a freshly launched app. */
export function withApp(): () => LaunchedApp {
  let current: LaunchedApp | undefined;
  test.beforeEach(async () => {
    current = await launchApp();
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
