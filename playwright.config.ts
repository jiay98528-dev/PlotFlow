import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/app/e2e',
  timeout: 30000,
  retries: 1,
  webServer: {
    command: '.\\node_modules\\.bin\\vite.CMD packages/app --host 127.0.0.1 --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
    baseURL: 'http://127.0.0.1:5186',
  },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
});
