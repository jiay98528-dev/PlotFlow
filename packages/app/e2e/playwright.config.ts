import { defineConfig } from '@playwright/test';

/**
 * PlotFlow E2E Playwright 配置
 *
 * 使用 Electron 适配器启动 PlotFlow 应用进行端到端测试。
 * 测试前需确保已执行 `pnpm build`（或 `electron-vite build`），
 * 使得 out/main/main.js 为可用的 Electron 主进程入口。
 *
 * 可通过环境变量覆盖：
 *   ELECTRON_MAIN  - 自定义 Electron 主进程入口路径
 *   CI             - CI 模式下重试 2 次
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.e2e.ts', '**/*.spec.ts'],
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1, // Electron 一次只能运行一个实例
  reporter: 'list',

  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'electron',
    },
  ],
});
