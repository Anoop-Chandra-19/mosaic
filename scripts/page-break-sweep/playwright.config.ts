import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: import.meta.dirname,
  workers: process.platform === 'linux' ? 4 : 1,
  reporter: 'list',
});
