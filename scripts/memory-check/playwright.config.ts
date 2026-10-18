import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: import.meta.dirname,
  // One app at a time: its memory is what's measured.
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
});
