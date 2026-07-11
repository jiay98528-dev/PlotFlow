/**
 * Playwright E2E 测试配置 — PlotFlow 文件操作测试
 *
 * 使用 @playwright/test 运行 Electron 端到端测试。
 * 默认连接到已构建的 electron-vite 输出。
 *
 * 使用方式:
 *   1. 构建应用:  pnpm build
 *   2. 运行测试:  npx playwright test --config=packages/app/src/__tests__/e2e/playwright.config.ts
 *
 * @see https://playwright.dev/docs/api/class-testconfig
 */

import { defineConfig } from '@playwright/test';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..', '..', '..');

export default defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.ts',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1, // Electron 测试必须串行执行
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.resolve(ROOT_DIR, 'e2e-report') }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron',
      use: {
        // 不在此处定义 Electron 启动参数
        // 测试文件内通过 _electron.launch 自行启动
      },
    },
  ],
});
