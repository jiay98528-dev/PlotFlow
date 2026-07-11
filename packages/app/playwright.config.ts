/**
 * Playwright E2E 测试配置 — GhostText 幽灵补全
 *
 * 使用 Playwright Electron 启动 PlotFlow 桌面应用。
 * 启动方式: 直接使用 electron-vite build 产物，确保在运行测试前已构建。
 *
 * ## 前置条件
 * 1. 构建: pnpm build (或 electron-vite build)
 * 2. 运行: npx playwright test --config packages/app/playwright.config.ts
 *
 * @see ./src/__tests__/ghost-text-e2e.spec.ts
 */

import { defineConfig } from '@playwright/test';
import * as path from 'path';

export default defineConfig({
  testDir: path.resolve(__dirname, 'src/__tests__'),
  testMatch: '**/*-e2e.spec.ts',
  timeout: 120_000,
  fullyParallel: false,
  retries: 1,
  workers: 1,

  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'electron',
    },
  ],
});
