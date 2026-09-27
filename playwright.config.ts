import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Linux workers have separate Xvfb desktops. Other platforms still share a desktop.
  // Override with --workers=N to suit the machine; each app has several Chromium processes.
  workers: process.platform === 'linux' ? 4 : 1,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
});
