import { defineConfig } from '@playwright/test';

const retainAuthorityEvidence = process.env['PLOTFLOW_REVIEW_EVIDENCE'] === '1';

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.ts'],
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/e2e-blackbox/results.json' }],
  ],
  outputDir: '../../test-results/e2e-blackbox',

  use: {
    screenshot: retainAuthorityEvidence ? 'on' : 'only-on-failure',
    video: retainAuthorityEvidence ? 'on' : 'retain-on-failure',
    trace: retainAuthorityEvidence ? 'on' : 'retain-on-failure',
  },

  projects: [
    {
      name: 'electron-blackbox',
    },
  ],
});
