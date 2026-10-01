import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: import.meta.dirname,
  // One app at a time: two would compete for the CPU being measured.
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
});
