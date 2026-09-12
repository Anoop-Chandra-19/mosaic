import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Every test launches its own Electron app with its own profile. One at a time keeps
  // the headless display and machine load predictable.
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
});
